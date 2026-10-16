import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import type { GmailStatus } from '@/types';

// Gmail OAuth configuration - client ID is public, not secret
const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID as string;
const REDIRECT_URI = 'https://pipeline-crm-demo.web.app/settings';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/contacts.readonly',
].join(' ');

export function useGmail() {
  const [status, setStatus] = useState<GmailStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      // Read Gmail status directly from Firestore
      const configDoc = await getDoc(doc(db, 'config', 'gmail'));

      if (!configDoc.exists()) {
        setStatus({ connected: false });
      } else {
        const config = configDoc.data();
        setStatus({
          connected: true,
          email: config?.email,
          connectedAt: config?.connectedAt?.toDate?.() || config?.connectedAt,
        });
      }
    } catch (error) {
      console.error('Error checking Gmail status:', error);
      setStatus({ connected: false, error: 'Failed to check connection status' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    // Check for OAuth code or status in URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const gmailStatus = params.get('gmail');

    if (code) {
      // Exchange the code via Firestore trigger
      setConnecting(true);
      console.log('[Gmail OAuth] Received code from Google, starting exchange...');
      console.log('[Gmail OAuth] Code (first 20 chars):', code.substring(0, 20) + '...');

      const exchangeCode = async () => {
        try {
          const exchangeId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const exchangeRef = doc(db, 'gmailCodeExchange', exchangeId);
          console.log('[Gmail OAuth] Creating exchange document:', exchangeId);

          // Write the code for the trigger to process
          await setDoc(exchangeRef, {
            code: code,
            createdAt: Timestamp.now(),
            status: 'pending',
          });
          console.log('[Gmail OAuth] Exchange document created, waiting for Firestore trigger...');

          // Listen for the result
          let updateCount = 0;
          const unsubscribe = onSnapshot(exchangeRef, (snapshot) => {
            const data = snapshot.data();
            updateCount++;
            console.log(`[Gmail OAuth] Snapshot update #${updateCount}:`, {
              status: data?.status,
              error: data?.error,
              email: data?.email,
              hasCompletedAt: !!data?.completedAt,
            });

            if (data?.status === 'completed') {
              console.log('[Gmail OAuth] Exchange completed successfully!');
              unsubscribe();
              setStatus({
                connected: true,
                email: data.email,
                connectedAt: new Date(),
              });
              setConnecting(false);
              window.history.replaceState({}, '', window.location.pathname);
            } else if (data?.status === 'error') {
              console.error('[Gmail OAuth] Exchange failed:', data.error);
              unsubscribe();
              setStatus({ connected: false, error: data.error || 'Failed to connect' });
              setConnecting(false);
              window.history.replaceState({}, '', window.location.pathname);
            }
          });

          // Timeout after 30 seconds
          setTimeout(() => {
            console.warn('[Gmail OAuth] Timeout reached (30s) - trigger may not have fired');
            unsubscribe();
            setConnecting(false);
            setStatus({ connected: false, error: 'Connection timeout - trigger may not be deployed' });
          }, 30000);
        } catch (error) {
          console.error('[Gmail OAuth] Error creating exchange document:', error);
          setStatus({ connected: false, error: 'Failed to exchange code' });
          setConnecting(false);
        }
      };
      exchangeCode();
      // Clean up URL immediately to prevent re-processing
      window.history.replaceState({}, '', window.location.pathname);
    } else if (gmailStatus === 'connected') {
      checkStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (gmailStatus === 'error') {
      setStatus({ connected: false, error: 'Failed to connect Gmail' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkStatus]);

  const connect = useCallback(() => {
    // Generate OAuth URL directly in the browser - no Cloud Function needed!
    // The client ID is public (not secret), so this is safe
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GMAIL_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    // Redirect to Google OAuth
    window.location.href = authUrl.toString();
  }, []);

  const disconnect = useCallback(async () => {
    try {
      // Delete Gmail config directly from Firestore
      await deleteDoc(doc(db, 'config', 'gmail'));
      setStatus({ connected: false });
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
    }
  }, []);

  return {
    status,
    loading,
    connecting,
    connect,
    disconnect,
    refresh: checkStatus,
  };
}
