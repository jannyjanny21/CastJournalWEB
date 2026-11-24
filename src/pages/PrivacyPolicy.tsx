import { useNavigate } from 'react-router-dom';

export function PrivacyPolicy() {
  const navigate = useNavigate();
  // Opened from the Register checkbox in a new tab there's no history to go back to.
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <button type="button" onClick={goBack} className="mb-6 text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>
      <h1 className="mb-2 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: November 2026</p>

      <p className="mb-6">
        CastJournal ("we", "our", "the app") is a capstone project for logging and
        sharing fishing catches. This page explains what information we collect and
        how it is used.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Information we collect</h2>
      <ul className="mb-6 list-disc space-y-2 pl-6">
        <li>
          <strong>Account information:</strong> your name, email address, and username,
          either entered directly or provided by Google when you sign in with your
          Google account.
        </li>
        <li>
          <strong>Content you add:</strong> fishing trips and their catches (species,
          weight, length, gear, bait, method, photos, videos, notes), your saved fishing
          locations with their map positions, comments, likes and follow relationships.
        </li>
        <li>
          <strong>Usage data:</strong> basic activity needed to run features like
          notifications and search.
        </li>
      </ul>

      <h2 className="mb-2 mt-8 text-xl font-semibold">What other anglers can see</h2>
      <ul className="mb-6 list-disc space-y-2 pl-6">
        <li>
          <strong>Trips are private until you publish them.</strong> Before publishing you see
          exactly what will be shown, and you can withdraw a published trip at any time.
        </li>
        <li>
          <strong>Private fishing spots stay hidden.</strong> When you publish a trip that uses a
          private spot, other anglers see "Location hidden" unless you explicitly choose to show it.
        </li>
        <li>
          <strong>Your profile:</strong> your name, username, profile picture and bio are visible to
          other signed-in anglers, along with your published trips.
        </li>
        <li>
          <strong>Weather, moon and tide conditions</strong> for your trips are looked up from
          Open-Meteo using the spot's approximate position (rounded to about 1 km). No account
          details are sent.
        </li>
      </ul>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Google sign-in</h2>
      <p className="mb-6">
        When you sign in with Google, we only request your basic profile information
        (name, email address, profile picture) to create and log you into your
        CastJournal account. We do not access your Gmail, Google Drive, or any other
        Google service.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">How we use your information</h2>
      <p className="mb-6">
        You are asked to accept this notice when you create an account, and the time you
        accepted it is recorded. Your information is used to operate core features of the app: authentication,
        displaying your catches and profile, the community feed, search, and
        analytics. We do not sell your data or share it with third parties for
        advertising.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Data storage</h2>
      <p className="mb-6">
        Data is stored in our application database and is retained for as long as
        your account is active. You may request deletion of your account and
        associated data by contacting us at the email below.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Academic project notice</h2>
      <p className="mb-6">
        CastJournal is developed as a capstone/thesis project. It is not a commercial
        product, but the same care is taken with your data as described in this
        policy.
      </p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">Contact</h2>
      <p>
        Questions about this policy can be sent to{' '}
        <a href="mailto:clarencebaquiller@gmail.com" className="underline underline-offset-4">
          clarencebaquiller@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
