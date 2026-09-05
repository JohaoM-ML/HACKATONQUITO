import { RoleLogin } from "@/components/auth/RoleLogin";

export default function JefeLoginPage() {
  return <RoleLogin rol="jefe" successHref="/panel" />;
}
