import { Suspense } from "react";
import { Nav } from "@/components/Brand";
import { AuthForm } from "@/components/AuthForm";
export default function Page() { return <><Nav /><main className="hex px-5 py-14"><Suspense><AuthForm mode="login" /></Suspense></main></>; }
