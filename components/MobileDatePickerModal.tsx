"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function startOfMonth(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(1);
  return copy;
}

function addMonths(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + amount, 1);
  return copy;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return formatDateKey(a) === formatDateKey(b);
}

function buildMonthDays(baseDate: Date) {
  const firstDay = startOfMonth(baseDate);
  const totalDays = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
  const offset = firstDay.getDay();

  return {
    offset,
    days: Array.from({ length: totalDays }, (_, index) => new Date(baseDate.getFullYear(), baseDate.getMonth(), index + 1)),
  };
}

function formatHeaderDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type MobileDatePickerModalProps = {
  open: boolean;
  value: Date;
  minDate?: Date | null;
  maxDate?: Date | null;
  onClose: () => void;
  onConfirm: (value: Date) => void;
};

export default function MobileDatePickerModal({
  open,
  value,
  minDate = null,
  maxDate = null,
  onClose,
  onConfirm,
}: MobileDatePickerModalProps) {
  if (!open) return null;

  return (
    <MobileDatePickerModalContent
      key={`${formatDateKey(value)}-${minDate ? formatDateKey(minDate) : "none"}-${maxDate ? formatDateKey(maxDate) : "none"}`}
      value={value}
      minDate={minDate}
      maxDate={maxDate}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

type MobileDatePickerModalContentProps = Omit<MobileDatePickerModalProps, "open">;

function MobileDatePickerModalContent({
  value,
  minDate,
  maxDate,
  onClose,
  onConfirm,
}: MobileDatePickerModalContentProps) {
  const [draftDate, setDraftDate] = useState(value);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(value));
  const [showYearPicker, setShowYearPicker] = useState(false);

  const calendar = useMemo(() => buildMonthDays(calendarMonth), [calendarMonth]);
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = minDate?.getFullYear() ?? currentYear - 10;
    const endYear = maxDate?.getFullYear() ?? currentYear + 10;
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
  }, [maxDate, minDate]);

  function isDisabled(day: Date) {
    const normalized = new Date(day);
    normalized.setHours(0, 0, 0, 0);
    const afterMin = !minDate || normalized.getTime() >= new Date(minDate).setHours(0, 0, 0, 0);
    const beforeMax = !maxDate || normalized.getTime() <= new Date(maxDate).setHours(0, 0, 0, 0);
    return !afterMin || !beforeMax;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[6px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
        <div className="bg-[#0d9488] px-6 pb-7 pt-6 text-white">
          <button type="button" onClick={() => setShowYearPicker((current) => !current)} className="text-left">
            <div className="text-[1.15rem] font-medium text-white/85">{draftDate.getFullYear()}</div>
            <div className="mt-1 text-[2.6rem] font-semibold leading-none">{formatHeaderDate(draftDate)}</div>
          </button>
        </div>

        {showYearPicker ? (
          <div className="max-h-[420px] overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    const updated = new Date(draftDate);
                    updated.setFullYear(year);
                    setDraftDate(updated);
                    setCalendarMonth(startOfMonth(updated));
                    setShowYearPicker(false);
                  }}
                  className={`block w-full py-3 text-center text-[1.2rem] ${
                    year === draftDate.getFullYear() ? "font-semibold text-[#0d9488]" : "text-slate-700"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-5">
              <button type="button" onClick={() => setCalendarMonth((current) => addMonths(current, -1))} className="p-2 text-slate-700">
                <ChevronLeft className="h-6 w-6" />
              </button>

              <div className="text-[1.1rem] font-medium text-slate-800">
                {monthNames[calendarMonth.getMonth()]} de {calendarMonth.getFullYear()}
              </div>

              <button type="button" onClick={() => setCalendarMonth((current) => addMonths(current, 1))} className="p-2 text-slate-700">
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            <div className="px-6 pb-2">
              <div className="grid grid-cols-7 gap-y-3 text-center text-[1rem] text-slate-400">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            </div>

            <div className="px-6 pb-8">
              <div className="grid grid-cols-7 gap-y-3 text-center">
                {Array.from({ length: calendar.offset }).map((_, index) => (
                  <span key={`blank-${index}`} />
                ))}

                {calendar.days.map((day) => {
                  const selected = isSameDay(day, draftDate);
                  const disabled = isDisabled(day);

                  return (
                    <button
                      key={formatDateKey(day)}
                      type="button"
                      disabled={disabled}
                      onClick={() => setDraftDate(day)}
                      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-[1.25rem] ${
                        selected
                          ? "bg-[#0d9488] text-white"
                          : disabled
                            ? "text-slate-300"
                            : "text-slate-700"
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-10 px-6 pb-6 text-[1.2rem] font-medium uppercase">
          <button type="button" onClick={onClose} className="text-[#0d9488]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(draftDate);
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
