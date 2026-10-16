import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGmail } from '@/hooks/useGmail';
import { Mail, CheckCircle, XCircle, Loader2, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';

export const GmailConnection: React.FC = () => {
  const { status, loading, connecting, connect, disconnect } = useGmail();
  const [sendingTest, setSendingTest] = useState(false);

  const sendTestEmail = async () => {
    if (!status.email) return;

    setSendingTest(true);
    try {
      const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const requestRef = doc(db, 'testEmailRequests', requestId);

      // Write the request
      await setDoc(requestRef, {
        to: status.email,
        subject: 'Test Email from Pipeline CRM',
        body: '<p>This is a test email to verify your Gmail connection is working correctly.</p><p>If you received this, email sequences are ready to use!</p>',
        createdAt: Timestamp.now(),
        status: 'pending',
      });

      // Listen for result
      const unsubscribe = onSnapshot(requestRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.status === 'completed') {
          unsubscribe();
          toast.success('Test email sent successfully! Check your inbox.');
          setSendingTest(false);
        } else if (data?.status === 'error') {
          unsubscribe();
          toast.error(data.error || 'Failed to send test email');
          setSendingTest(false);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        unsubscribe();
        if (sendingTest) {
          toast.error('Test email timed out');
          setSendingTest(false);
        }
      }, 30000);
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('Failed to send test email');
      setSendingTest(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Gmail Connection
        </CardTitle>
        <CardDescription>
          Connect your Gmail account to send email sequences
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection status...
          </div>
        ) : status.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Connected</span>
            </div>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Account: </span>
                <span className="font-medium">{status.email}</span>
              </div>
              {status.connectedAt && (
                <div>
                  <span className="text-muted-foreground">Connected: </span>
                  <span>
                    {formatDistanceToNow(new Date(status.connectedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={sendTestEmail} disabled={sendingTest}>
                {sendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={disconnect}>
                Disconnect Gmail
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5" />
              <span>Not connected</span>
            </div>
            {status.error && (
              <p className="text-sm text-red-500">{status.error}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Connect your Gmail account to enable email sequences. This allows
              the CRM to send emails on your behalf and track replies.
            </p>
            <Button onClick={connect} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Gmail
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
