import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | Gramedia Kendari Tracker"
        description="Masuk ke sistem pelaporan Gramedia Kendari"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
