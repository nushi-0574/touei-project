import VerifyResidentCard from './VerifyResidentCard';

export default async function VerifyResidentCardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <VerifyResidentCard token={token} />;
}
