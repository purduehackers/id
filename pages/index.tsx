import Link from "next/link";

export default function Index() {
  return (
    <div className="p-4 max-w-lg">
      <h1 className="text-2xl font-bold font-mono">id.purduehackers.com</h1>
      <p>
        This is purdue hackers&rsquo; passport-based authentication service. You
        can&rsquo;t do very much here. Try using Sign In with Passport on a
        supported page,{" "}
        <span className="underline">
          <Link href="https://id-auth-example.purduehackers.com">
            like this one
          </Link>
        </span>
        .
      </p>
    </div>
  );
}
