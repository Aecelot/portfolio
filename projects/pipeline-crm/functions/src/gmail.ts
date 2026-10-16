import { getGmailClient, db, collections } from "./config";
import { LeadSequenceStatus, EmailEvent } from "./types";
import { Timestamp } from "firebase-admin/firestore";

// Base URL for tracking (will be the Firebase Functions URL)
const TRACKING_BASE_URL = "https://us-central1-pipeline-crm-demo.cloudfunctions.net";

/**
 * Create email with tracking pixel
 */
function createEmailWithTracking(
  to: string,
  subject: string,
  body: string,
  leadId: string,
  sequenceId: string,
  step: number
): string {
  const trackingId = Buffer.from(
    JSON.stringify({ leadId, sequenceId, step, t: Date.now() })
  ).toString("base64url");

  const trackingPixel = `<img src="${TRACKING_BASE_URL}/emailOpen?id=${trackingId}" width="1" height="1" style="display:none;" />`;

  // Wrap links for click tracking
  const bodyWithTracking = body.replace(
    /<a\s+href="([^"]+)"/g,
    (match, url) => {
      const clickId = Buffer.from(
        JSON.stringify({ leadId, sequenceId, step, url, t: Date.now() })
      ).toString("base64url");
      return `<a href="${TRACKING_BASE_URL}/emailClick?id=${clickId}"`;
    }
  );

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body>
      ${bodyWithTracking}
      ${trackingPixel}
    </body>
    </html>
  `;

  return htmlBody;
}

/**
 * Send an email via Gmail API
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  leadId: string,
  sequenceId: string,
  step: number
): Promise<{ messageId: string; threadId: string }> {
  const gmail = await getGmailClient();

  const htmlBody = createEmailWithTracking(to, subject, body, leadId, sequenceId, step);

  // Create the email in RFC 2822 format
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    htmlBody,
  ].join("\r\n");

  const encodedEmail = Buffer.from(email).toString("base64url");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedEmail,
    },
  });

  return {
    messageId: response.data.id || "",
    threadId: response.data.threadId || "",
  };
}

/**
 * Check for replies to sent emails
 */
export async function checkForReplies(): Promise<void> {
  const gmail = await getGmailClient();

  // Get all active sequences
  const activeSequences = await db
    .collection(collections.leadSequences)
    .where("status", "==", "active")
    .get();

  for (const doc of activeSequences.docs) {
    const sequenceStatus = doc.data() as LeadSequenceStatus;

    // Check each sent email for replies
    for (const event of sequenceStatus.history) {
      if (event.replied) continue; // Already marked as replied

      try {
        // Get the thread
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: event.threadId,
        });

        const messages = thread.data.messages || [];

        // If there's more than one message in the thread, someone replied
        if (messages.length > 1) {
          // Check if any message is from the recipient (not from us)
          const configDoc = await db.collection(collections.config).doc("gmail").get();
          const ourEmail = configDoc.data()?.email || "";

          const hasReply = messages.some((msg) => {
            const from = msg.payload?.headers?.find(
              (h) => h.name?.toLowerCase() === "from"
            )?.value || "";
            return !from.toLowerCase().includes(ourEmail.toLowerCase());
          });

          if (hasReply) {
            // Update the event as replied
            const updatedHistory = sequenceStatus.history.map((e) =>
              e.messageId === event.messageId
                ? { ...e, replied: true, repliedAt: Timestamp.now() }
                : e
            );

            // Pause the sequence
            await doc.ref.update({
              status: "replied",
              history: updatedHistory,
            });

            console.log(`Reply detected for lead ${sequenceStatus.leadId}`);
            break; // No need to check other emails for this lead
          }
        }
      } catch (error) {
        console.error(`Error checking thread ${event.threadId}:`, error);
      }
    }
  }
}

/**
 * Process scheduled emails
 */
export async function processScheduledEmails(): Promise<void> {
  const now = Timestamp.now();

  // Get sequences that need to send
  const dueSequences = await db
    .collection(collections.leadSequences)
    .where("status", "==", "active")
    .where("nextSendAt", "<=", now)
    .get();

  console.log(`Found ${dueSequences.size} sequences due to send`);

  for (const doc of dueSequences.docs) {
    const sequenceStatus = doc.data() as LeadSequenceStatus;

    try {
      // Get the sequence template
      const sequenceDoc = await db
        .collection(collections.sequences)
        .doc(sequenceStatus.sequenceId)
        .get();

      if (!sequenceDoc.exists) {
        console.error(`Sequence ${sequenceStatus.sequenceId} not found`);
        continue;
      }

      const sequence = sequenceDoc.data();
      const emails = sequence?.emails || [];
      const currentEmail = emails.find(
        (e: { order: number }) => e.order === sequenceStatus.currentStep
      );

      if (!currentEmail) {
        // Sequence complete
        await doc.ref.update({ status: "completed", nextSendAt: null });
        continue;
      }

      // Get lead info for personalization
      const leadDoc = await db
        .collection(collections.leads)
        .doc(sequenceStatus.leadId)
        .get();
      const lead = leadDoc.data();

      // Simple variable substitution
      let subject = currentEmail.subject;
      let body = currentEmail.body;

      if (lead) {
        subject = subject
          .replace(/\{\{name\}\}/g, lead.name || "")
          .replace(/\{\{company\}\}/g, lead.name || "")
          .replace(/\{\{firstName\}\}/g, sequenceStatus.recipientName?.split(" ")[0] || "");
        body = body
          .replace(/\{\{name\}\}/g, lead.name || "")
          .replace(/\{\{company\}\}/g, lead.name || "")
          .replace(/\{\{firstName\}\}/g, sequenceStatus.recipientName?.split(" ")[0] || "");
      }

      // Send the email
      const { messageId, threadId } = await sendEmail(
        sequenceStatus.recipientEmail,
        subject,
        body,
        sequenceStatus.leadId,
        sequenceStatus.sequenceId,
        sequenceStatus.currentStep
      );

      // Create email event
      const emailEvent: EmailEvent = {
        step: sequenceStatus.currentStep,
        sentAt: Timestamp.now(),
        messageId,
        threadId,
        opened: false,
        clicked: false,
        replied: false,
      };

      // Calculate next send date
      const nextEmail = emails.find(
        (e: { order: number }) => e.order === sequenceStatus.currentStep + 1
      );
      let nextSendAt: Timestamp | null = null;
      if (nextEmail) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + nextEmail.delayDays);
        nextSendAt = Timestamp.fromDate(nextDate);
      }

      // Update sequence status
      await doc.ref.update({
        currentStep: sequenceStatus.currentStep + 1,
        nextSendAt,
        status: nextSendAt ? "active" : "completed",
        history: [...sequenceStatus.history, emailEvent],
      });

      console.log(
        `Sent email ${sequenceStatus.currentStep} to ${sequenceStatus.recipientEmail}`
      );
    } catch (error) {
      console.error(`Error processing sequence for lead ${sequenceStatus.leadId}:`, error);
    }
  }
}
