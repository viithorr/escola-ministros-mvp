"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type MobileMonthYearPickerModalProps = {
  open: boolean;
  month: number;
  year: number;
  minYear?: number;
  maxYear?: number;
  onClose: () => void;
  onConfirm: (month: number, year: number) => void;
};

export default function MobileMonthYearPickerModal({
  open,
  month,
  year,
  minYear,
  maxYear,
  onClose,
  onConfirm,
}: MobileMonthYearPickerModalProps) {
  if (!open) return null;

  return (
    <MobileMonthYearPickerModalContent
      key={`${month}-${year}-${minYear ?? "none"}-${maxYear ?? "none"}`}
      month={month}
      year={year}
      minYear={minYear}
      maxYear={maxYear}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

type MobileMonthYearPickerModalContentProps = Omit<MobileMonthYearPickerModalProps, "open">;

function MobileMonthYearPickerModalContent({
  month,
  year,
  minYear,
  maxYear,
  onClose,
  onConfirm,
}: MobileMonthYearPickerModalContentProps) {
  const [draftMonth, setDraftMonth] = useState(month);
  const [draftYear, setDraftYear] = useState(year);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const start = minYear ?? currentYear - 10;
    const end = maxYear ?? currentYear + 10;
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [maxYear, minYear]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[6px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
        <div className="bg-[#0d9488] px-6 pb-7 pt-6 text-white">
          <div className="text-[1.15rem] font-medium text-white/85">{draftYear}</div>
          <div className="mt-1 text-[2.6rem] font-semibold leading-none">{monthNames[draftMonth - 1]} de {draftYear}</div>
        </div>

        <div className="flex items-center justify-between px-6 py-5">
          <button type="button" onClick={() => setDraftYear((current) => current - 1)} className="p-2 text-slate-700">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="text-[1.1rem] font-medium text-slate-800">{draftYear}</div>
          <button type="button" onClick={() => setDraftYear((current) => current + 1)} className="p-2 text-slate-700">
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 pb-5">
          {monthNames.map((item, index) => {
            const value = index + 1;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setDraftMonth(value)}
                className={`rounded-[14px] px-4 py-4 text-base font-medium ${
                  draftMonth === value ? "bg-[#0d9488] text-white" : "bg-slate-50 text-slate-700"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="max-h-[180px] overflow-y-auto px-6 pb-4">
          <div className="space-y-2">
            {years.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDraftYear(item)}
                className={`block w-full py-2 text-center text-lg ${item === draftYear ? "font-semibold text-[#0d9488]" : "text-slate-600"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-10 px-6 pb-6 text-[1.2rem] font-medium uppercase">
          <button type="button" onClick={onClose} className="text-[#0d9488]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(draftMonth, draftYear);
              onClose();
            }}
            className="text-[#0d9488]"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
