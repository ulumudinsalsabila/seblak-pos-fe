import { InventoryNav } from "./inventory-ui";

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <InventoryNav />
      {children}
    </>
  );
}
