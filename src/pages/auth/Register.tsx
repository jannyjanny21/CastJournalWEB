import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { CastDivider } from '../../components/CastDivider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { CircleX } from 'lucide-react';


const registerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  userName: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or fewer'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [serverPasswordErrors, setServerPasswordErrors] = useState<string[]>([]);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', userName: '', email: '', password: '' },
  });

  const onSubmit = async (values: RegisterValues) => {
    setServerPasswordErrors([]);

    try {
      await register(values);
      navigate('/feed');
    } catch (err) {
      const error = err as {
        message?: string;
        details?: unknown;
      };

      const identityErrors = Array.isArray(error.details)
        ? error.details
          .map((item) => item?.description)
          .filter((message): message is string => Boolean(message))
        : [];

      if (identityErrors.length > 0) {
        setServerPasswordErrors(identityErrors);
        form.setError('password', {
          type: 'server',
          message: 'Please meet all password requirements.',
        });
      } else {
        form.setError('root', {
          message: error.message ?? 'Something went wrong. Please try again.',
        });
      }
    }
  };

  return (
    <AuthLayout>
      <Card
        className="border-white/40 backdrop-blur-xl"
        style={{ backgroundColor: 'color-mix(in oklab, var(--color-surface) 70%, transparent)' }}
      >
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <CastDivider />
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input type="text" autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input type="text" autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                        onChange={(event) => {
                          setServerPasswordErrors([]);
                          form.clearErrors('password');
                          field.onChange(event);
                        }}
                      />
                    </FormControl>
                    {serverPasswordErrors.length > 0 ? (
                      <ul className="space-y-1 text-sm italic text-destructive" role="alert">
                        {serverPasswordErrors.map((message) => (
                          <li key={message} className="flex items-start gap-1.5">
                            <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            <span>{message}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <FormMessage />
                    )}
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.root.message}
                </p>
              )}

              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          </Form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <GoogleSignInButton
            text="signup_with"
            onSuccess={() => navigate('/feed')}
            onError={(message) => form.setError('root', { message })}
          />
          <p className="mt-5 text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}