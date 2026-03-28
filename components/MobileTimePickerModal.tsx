"use client";

import { useMemo, useState } from "react";

const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minuteOptions = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

type MobileTimePickerModalProps = {
  open: boolean;
  hour: string;
  minute: string;
  onClose: () => void;
  onConfirm: (hour: string, minute: string) => void;
};

export default function MobileTimePickerModal({
  open,
  hour,
  minute,
  onClose,
  onConfirm,
}: MobileTimePickerModalProps) {
  if (!open) return null;

  return (
    <MobileTimePickerModalContent
      key={`${hour}:${minute}`}
      hour={hour}
      minute={minute}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

type MobileTimePickerModalContentProps = Omit<MobileTimePickerModalProps, "open">;

function MobileTimePickerModalContent({
  hour,
  minute,
  onClose,
  onConfirm,
}: MobileTimePickerModalContentProps) {
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);

  const preview = useMemo(() => `${draftHour}:${draftMinute}`, [draftHour, draftMinute]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[6px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
        <div className="bg-[#0d9488] px-6 pb-7 pt-6 text-white">
          <div className="text-[1.15rem] font-medium text-white/85">Horario</div>
          <div className="mt-1 text-[2.6rem] font-semibold leading-none">{preview}</div>
        </div>

        <div className="grid grid-cols-2 gap-5 px-6 py-6">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">Hora</p>
            <div className="grid grid-cols-4 gap-2">
              {hourOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraftHour(value)}
                  className={`rounded-[12px] px-3 py-3 text-sm font-medium ${
                    draftHour === value ? "bg-[#0d9488] text-white" : "bg-slate-50 text-slate-700"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">Minuto</p>
            <div className="grid grid-cols-3 gap-2">
              {minuteOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraftMinute(value)}
                  className={`rounded-[12px] px-3 py-3 text-sm font-medium ${
                    draftMinute === value ? "bg-[#0d9488] text-white" : "bg-slate-50 text-slate-700"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-10 px-6 pb-6 text-[1.2rem] font-medium uppercase">
          <button type="button" onClick={onClose} className="text-[#0d9488]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(draftHour, draftMinute);
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
