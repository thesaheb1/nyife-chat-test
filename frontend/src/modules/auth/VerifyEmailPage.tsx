import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AuthLayout } from '@/shared/layouts/AuthLayout';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }

    const verify = async () => {
      try {
        const { data } = await apiClient.post(ENDPOINTS.AUTH.VERIFY_EMAIL, { token });
        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
      } catch (error) {
        setStatus('error');
        setMessage(
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Email verification failed. The link may have expired.'
        );
      }
    };

    verify();
  }, [token]);

  return (
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto mb-2">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle>Verifying Email</CardTitle>
              <CardDescription>Please wait while we verify your email address...</CardDescription>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="mx-auto mb-2">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle>Email Verified</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="mx-auto mb-2">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle>Verification Failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        {status !== 'loading' && (
          <CardContent className="text-center">
            <Link to="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        )}
      </Card>
    </AuthLayout>
  );
}
