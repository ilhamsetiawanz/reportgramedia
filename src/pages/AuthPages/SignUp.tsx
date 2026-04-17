import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Sign Up | Gramedia Kendari Tracker"
        description="Pendaftaran akun baru Gramedia Kendari"
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
