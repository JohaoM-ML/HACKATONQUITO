import { RoleLogin } from "@/components/auth/RoleLogin";

export default function BrigadaLoginPage() {
  return <RoleLogin rol="brigadista" successHref="/ruta" />;
}
