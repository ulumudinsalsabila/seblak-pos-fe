"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { api } from "@/lib/api";
import { dateTime, localDate, rupiah } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { SearchSelect } from "@/components/form-controls";

type TransactionListResponse = {
  data: Transaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type TransactionFilters = {
  invoiceNo: string;
  status: string;
  paymentMethod: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
};

function transactionParams(
  filters: TransactionFilters,
  page = filters.page,
  limit = filters.limit,
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters.invoiceNo) params.set("invoiceNo", filters.invoiceNo);
  if (filters.status) params.set("status", filters.status);
  if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params;
}

function xmlText(value: string | number) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

async function createTransactionWorkbook(transactions: Transaction[]) {
  const { strToU8, zipSync } = await import("fflate");
  const headers = [
    "Invoice",
    "Waktu",
    "Customer",
    "Kasir",
    "Pembayaran",
    "Status",
    "Subtotal",
    "Diskon",
    "Pajak",
    "Total",
  ];
  const rows: Array<Array<string | number>> = [
    headers,
    ...transactions.map((item) => [
      item.invoiceNo,
      dateTime(item.paidAt),
      item.customerName,
      item.cashier.name,
      item.paymentMethod,
      item.status,
      item.subtotal,
      item.discount,
      item.tax,
      item.total,
    ]),
  ];
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (rowIndex > 0 && columnIndex >= 6) {
            return `<c r="${reference}" s="2"><v>${value}</v></c>`;
          }
          const style = rowIndex === 0 ? ' s="1"' : "";
          return `<c r="${reference}" t="inlineStr"${style}><is><t>${xmlText(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="24" customHeight="1"' : ""}>${cells}</row>`;
    })
    .join("");
  const lastRow = Math.max(1, rows.length);
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:J${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="4" width="22" customWidth="1"/><col min="5" max="6" width="16" customWidth="1"/><col min="7" max="10" width="18" customWidth="1"/></cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A1:J${lastRow}"/>
</worksheet>`;
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Transaksi" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": worksheet,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7562C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, strToU8(content)]),
    ),
    { level: 6 },
  );
}

export default function TransactionsPage() {
  const today = localDate();
  const [filters, setFilters] = useState<TransactionFilters>({
    invoiceNo: "",
    status: "",
    paymentMethod: "",
    dateFrom: today,
    dateTo: today,
    page: 1,
    limit: 20,
  });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  const query = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () =>
      api<TransactionListResponse>(
        `/transactions?${transactionParams(filters)}`,
      ),
    placeholderData: keepPreviousData,
  });

  function updateFilter(key: keyof TransactionFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  async function exportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const allTransactions: Transaction[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await api<TransactionListResponse>(
          `/transactions?${transactionParams(filters, page, 100)}`,
        );
        allTransactions.push(...response.data);
        totalPages = response.meta.totalPages;
        page += 1;
      } while (page <= totalPages);

      const buffer = await createTransactionWorkbook(allTransactions);
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(buffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `transaksi-${filters.dateFrom || "semua"}-${filters.dateTo || "semua"}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error);
    } finally {
      setExporting(false);
    }
  }

  if (query.isLoading) return <Loading />;
  if (query.error && !query.data) return <ErrorNotice error={query.error} />;

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Riwayat pembayaran dan audit void."
        action={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            disabled={exporting || !meta?.total}
            onClick={exportExcel}
          >
            <Download size={18} />
            {exporting ? "Menyiapkan..." : "Export Excel"}
          </button>
        }
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <input
          className="field"
          placeholder="Cari invoice..."
          value={filters.invoiceNo}
          onChange={(event) => updateFilter("invoiceNo", event.target.value)}
        />
        <SearchSelect
          value={filters.status}
          placeholder="Semua status"
          clearable
          options={[
            { value: "PAID", label: "PAID" },
            { value: "VOID", label: "VOID" },
          ]}
          onChange={(value) => updateFilter("status", value)}
        />
        <SearchSelect
          value={filters.paymentMethod}
          placeholder="Semua pembayaran"
          clearable
          options={[
            { value: "CASH", label: "CASH" },
            { value: "QRIS", label: "QRIS" },
            { value: "TRANSFER", label: "TRANSFER" },
          ]}
          onChange={(value) => updateFilter("paymentMethod", value)}
        />
        <input
          aria-label="Dari tanggal"
          title="Dari tanggal"
          className="field"
          type="date"
          value={filters.dateFrom}
          onChange={(event) => updateFilter("dateFrom", event.target.value)}
        />
        <input
          aria-label="Sampai tanggal"
          title="Sampai tanggal"
          className="field"
          type="date"
          value={filters.dateTo}
          onChange={(event) => updateFilter("dateTo", event.target.value)}
        />
      </div>

      {exportError && <ErrorNotice error={exportError} />}
      {query.error && <ErrorNotice error={query.error} />}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#eadfd3] px-4 py-3 text-sm text-[#796c63]">
          <span>
            {meta ? `${meta.total} transaksi ditemukan` : "Daftar transaksi"}
          </span>
          {query.isFetching && (
            <span className="font-semibold text-[#e7562c]">Memuat...</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#eadfd3] bg-[#fff8f1] text-xs text-[#796c63]">
              <tr>
                <th className="p-4">INVOICE</th>
                <th className="p-4">WAKTU</th>
                <th className="p-4">KASIR</th>
                <th className="p-4">PEMBAYARAN</th>
                <th className="p-4">STATUS</th>
                <th className="p-4 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[#f1e8df] hover:bg-orange-50/40"
                >
                  <td className="p-4">
                    <Link
                      className="font-black text-[#e7562c]"
                      href={`/transactions/${item.id}`}
                    >
                      {item.invoiceNo}
                    </Link>
                    <p className="mt-1 text-xs text-[#796c63]">
                      {item.customerName}
                    </p>
                  </td>
                  <td className="p-4">{dateTime(item.paidAt)}</td>
                  <td className="p-4">{item.cashier.name}</td>
                  <td className="p-4 font-bold">{item.paymentMethod}</td>
                  <td className="p-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="p-4 text-right font-black">
                    {rupiah(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && <Empty>Belum ada transaksi pada filter ini.</Empty>}
        {meta && meta.totalPages > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd3] bg-[#fffdfa] px-4 py-3">
            <p className="text-sm text-[#796c63]">
              Halaman <b className="text-[#241c17]">{meta.page}</b> dari{" "}
              <b className="text-[#241c17]">{meta.totalPages}</b>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost flex items-center gap-1"
                disabled={filters.page <= 1 || query.isFetching}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: Math.max(1, current.page - 1),
                  }))
                }
              >
                <ChevronLeft size={17} />
                Sebelumnya
              </button>
              <button
                type="button"
                className="btn-ghost flex items-center gap-1"
                disabled={filters.page >= meta.totalPages || query.isFetching}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: Math.min(meta.totalPages, current.page + 1),
                  }))
                }
              >
                Berikutnya
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
