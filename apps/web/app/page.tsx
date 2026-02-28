import { formatCurrency } from "@pladuk/shared/utils";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">
        PlaDuk — {formatCurrency(420.69)}
      </h1>
    </div>
  );
}
