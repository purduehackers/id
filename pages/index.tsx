import Link from "next/link";

export default function Index() {
  return (
    <div className="p-4 max-w-lg">
      <h1 className="text-2xl font-bold font-mono">id.purduehackers.com</h1>
      <p>
        this is purdue hackers&rsquo; passport-based authentication service.
        WIP, please do not use unless you&rsquo;ve talked with jack or matthew.
      </p>
      <Link href="/authorize" className="underline">
        get started here
      </Link>
    </div>
  );
}
