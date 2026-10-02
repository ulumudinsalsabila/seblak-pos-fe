import type { Transaction } from "@/lib/types";
import { dateTime, rupiah } from "@/lib/format";
const itemOptions = (item: Transaction["items"][number]) => {
  if (item.selectedOptions?.length)
    return item.selectedOptions.map((option) => `${option.groupName} ${option.valueLabel}`).join(" · ");
  const taste = { SALTY: "Asin", SAVORY: "Gurih", SWEET: "Manis" }[item.tastePreference];
  const broth = { LITTLE: "Sedikit", MEDIUM: "Sedang", MUCH: "Banyak" }[item.brothLevel];
  return `Rasa ${taste} · Pedas ${item.spicyLevel} · Kuah ${broth}`;
};
export function Receipt({ transaction }: { transaction: Transaction }) {
  const width =
    transaction.receiptPaperSize === "MM80" ? "max-w-[80mm]" : "max-w-[58mm]";
  const orderType =
    transaction.orderType === "TAKEAWAY" ? "Bungkus" : "Makan di tempat";
  const broth = { LITTLE: "Sedikit", MEDIUM: "Sedang", MUCH: "Banyak" }[
    transaction.brothLevel
  ];
  const taste = { SALTY: "Asin", SAVORY: "Gurih", SWEET: "Manis" }[
    transaction.tastePreference
  ];
  return (
    <div
      className={`receipt-print card mx-auto ${width} p-5 font-mono text-[11px] leading-5 text-black`}
    >
      <div className="text-center">
        <h2 className="text-base font-black">{transaction.storeName}</h2>
        {transaction.storeAddress && <p>{transaction.storeAddress}</p>}
        {transaction.storePhone && <p>{transaction.storePhone}</p>}
        {transaction.receiptHeader && (
          <p className="mt-2">{transaction.receiptHeader}</p>
        )}
      </div>
      <div className="my-3 border-y border-dashed border-black py-2">
        <p>{transaction.invoiceNo}</p>
        <p>{dateTime(transaction.paidAt)}</p>
        <p>Kasir: {transaction.cashier.name}</p>
        <p>Customer: {transaction.customerName}</p>
        <p>{orderType}</p>
      </div>
      <div className="space-y-2">
        {transaction.items.map((item) => (
          <div key={item.id}>
            <p>{item.productName}</p>
            <div className="flex justify-between">
              <span>
                {item.quantity} × {rupiah(item.unitPrice)}
              </span>
              <b>{rupiah(item.subtotal)}</b>
            </div>
            <p className="text-[10px]"><b>Opsi:</b> {itemOptions(item)}</p>
            {item.notes && <p className="font-bold">Catatan: {item.notes}</p>}
          </div>
        ))}
      </div>
      <div className="my-3 space-y-1 border-y border-dashed border-black py-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{rupiah(transaction.subtotal)}</span>
        </div>
        {transaction.discount > 0 && (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span>-{rupiah(transaction.discount)}</span>
          </div>
        )}
        {transaction.tax > 0 && (
          <div className="flex justify-between">
            <span>Pajak</span>
            <span>{rupiah(transaction.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black">
          <span>TOTAL</span>
          <span>{rupiah(transaction.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>{transaction.paymentMethod}</span>
          <span>
            {transaction.amountReceived
              ? rupiah(transaction.amountReceived)
              : "LUNAS"}
          </span>
        </div>
        {transaction.changeAmount > 0 && (
          <div className="flex justify-between">
            <span>Kembali</span>
            <span>{rupiah(transaction.changeAmount)}</span>
          </div>
        )}
      </div>
      <p>Level pedas: {transaction.spicyLevel}</p>
      <p>Kuah: {broth}</p>
      <p>Rasa: {taste}</p>
      {transaction.notes && <p>Catatan: {transaction.notes}</p>}
      {transaction.status === "VOID" && (
        <p className="mt-3 border border-black p-2 text-center font-black">
          VOID — {transaction.voidReason}
        </p>
      )}
      <p className="mt-5 text-center">
        {transaction.receiptFooter ?? "Terima kasih!"}
      </p>
    </div>
  );
}

export function KitchenReceipt({ transaction }: { transaction: Transaction }) {
  const width =
    transaction.receiptPaperSize === "MM80" ? "max-w-[80mm]" : "max-w-[58mm]";
  const orderType =
    transaction.orderType === "TAKEAWAY" ? "BUNGKUS" : "MAKAN DI TEMPAT";
  const broth = { LITTLE: "Sedikit", MEDIUM: "Sedang", MUCH: "Banyak" }[
    transaction.brothLevel
  ];
  const taste = { SALTY: "Asin", SAVORY: "Gurih", SWEET: "Manis" }[
    transaction.tastePreference
  ];
  const hasMasterOptions = transaction.items.some((item) => item.selectedOptions?.length);

  return (
    <div
      className={`receipt-print card mx-auto ${width} p-5 font-mono text-xs leading-5 text-black`}
    >
      <div className="text-center">
        <h2 className="text-lg font-black">PESANAN DAPUR</h2>
        <p className="text-[10px]">{transaction.storeName}</p>
      </div>

      <div className="my-3 border-y border-dashed border-black py-2">
        <p className="text-sm font-black">{transaction.invoiceNo}</p>
        <p>{dateTime(transaction.paidAt)}</p>
        <p className="mt-1 text-base font-black">{transaction.customerName}</p>
        <p className="mt-2 border-2 border-black p-2 text-center text-sm font-black">
          {orderType}
        </p>
      </div>

      <div className="space-y-3">
        {transaction.items.map((item) => (
          <div className="flex gap-3 text-base leading-5" key={item.id}>
            <b className="min-w-8 text-lg">{item.quantity}×</b>
            <div><p className="font-bold">{item.productName}</p><p className="text-xs font-normal"><b>OPSI:</b> {itemOptions(item)}</p>{item.notes && <p className="mt-1 border border-black p-1 text-xs font-black">CATATAN: {item.notes}</p>}</div>
          </div>
        ))}
      </div>

      <div className="my-3 space-y-1 border-y border-dashed border-black py-2">
        {!hasMasterOptions && <><div className="flex justify-between">
          <span>Level pedas</span>
          <b>{transaction.spicyLevel}</b>
        </div>
        <div className="flex justify-between">
          <span>Kuah</span>
          <b>{broth}</b>
        </div>
        <div className="flex justify-between">
          <span>Rasa</span>
          <b>{taste}</b>
        </div></>}
        {transaction.notes && (
          <p className="mt-2 border border-black p-2 font-black">
            CATATAN: {transaction.notes}
          </p>
        )}
      </div>

      {transaction.status === "VOID" && (
        <p className="mt-3 border-2 border-black p-2 text-center text-base font-black">
          VOID — {transaction.voidReason}
        </p>
      )}
    </div>
  );
}
