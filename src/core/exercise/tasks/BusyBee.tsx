/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import mascotBee from '@/core/assets/mascot-bee.png';
import type { MascotMessage } from '../mascotInstruction';
import { TaskStatus } from './types';

interface BusyBeeProps {
  status: TaskStatus;
  message?: MascotMessage;
}

type MascotRun = Exclude<MascotMessage, string>[number];

/**
 * Một run của gợi ý người soạn, giữ định dạng (SBT-73): vần *ăc, âc* in nghiêng…
 *
 * Tự dựng phần tử React thay vì gọi `RichTextValue`: chuỗi import của nó kéo
 * rich-text/html → DOMPurify vào mọi màn có mascot, và nó còn đổi "1/2" thành
 * phân số — lời nhắc chỉ cần mấy kiểu chữ này. React tự thoát ký tự nên không
 * cần làm sạch HTML.
 */
const MascotRunText: React.FC<{ run: MascotRun }> = ({ run }) => {
  const marks = run.annotations ?? {};
  let node: React.ReactNode = run.text;
  if (marks.subscript) node = <sub>{node}</sub>;
  if (marks.superscript) node = <sup>{node}</sup>;
  if (marks.bold) node = <strong className="font-black">{node}</strong>;
  if (marks.italic) node = <em>{node}</em>;
  if (marks.underline) node = <u>{node}</u>;
  if (marks.strike) node = <s>{node}</s>;
  if (typeof marks.color === 'string' && marks.color) node = <span style={{ color: marks.color }}>{node}</span>;
  return <>{node}</>;
};

function hasMessage(message: MascotMessage | undefined): message is MascotMessage {
  return typeof message === 'string' ? message.length > 0 : Array.isArray(message) && message.length > 0;
}

interface BusyBeeMascotProps {
  size?: string;
}

export const BusyBeeMascot: React.FC<BusyBeeMascotProps> = ({ size = "w-full h-full" }) => {
  const [imageError, setImageError] = React.useState(false);

  return (
    <div className={`relative ${size} flex items-center justify-center`}>
      {!imageError ? (
        <img
          src={mascotBee}
          alt="Mascot Bé Ong"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain drop-shadow-2xl"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="relative w-full h-full flex items-center justify-center bg-yellow-400 rounded-full border-4 border-white shadow-xl">
          <div className="text-4xl">🐝</div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <span className="text-[10px]">✨</span>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export const BusyBee: React.FC<BusyBeeProps> = ({ status, message }) => {
  return (
    <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
      <motion.div
        animate={
          status === 'success' ? { rotate: [0, -10, 10, -10, 10, 0], y: [0, -15, 0], scale: [1, 1.1, 1] } :
          status === 'error' ? { x: [-10, 10, -10, 10, 0] } :
          { y: [0, -8, 0] }
        }
        transition={{
          duration: status === 'idle' ? 2.5 : 0.5,
          repeat: status === 'idle' ? Infinity : 0,
          ease: "easeInOut"
        }}
        // Kích thước do inline style quyết định (clamp theo bề rộng màn). Giữ nhỏ
        // vừa đủ nhận ra con ong: footer runner nằm đè lên diện tích đọc đề, mỗi
        // px thừa ở đây là px mất của nội dung câu hỏi.
        className="relative shrink-0 flex items-center justify-center drop-shadow-2xl"
        style={{ width: 'clamp(2.25rem, 4vw, 3.5rem)', height: 'clamp(2.25rem, 4vw, 3.5rem)' }}
      >
        <BusyBeeMascot />

        {status === 'success' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1.5, opacity: [0.5, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute inset-0 bg-yellow-400/30 rounded-full -z-10 blur-xl"
          />
        )}
      </motion.div>
      {hasMessage(message) && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          // Gợi ý có định dạng: chữ thường hạ xuống font-bold để run đậm (font-black)
          // nhìn ra được — trên nền font-black, <strong> vẫn chỉ là 900.
          className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-2xl border-2 text-center text-xs sm:text-sm ${typeof message === 'string' ? 'font-black' : 'font-bold'} shadow-lg relative min-w-0 max-w-[15rem] sm:max-w-sm md:max-w-md
            ${status === 'success' ? 'bg-green-50 border-green-200 text-green-600' :
              status === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
              'bg-white border-yellow-200 text-slate-700'}
          `}
        >
          <div className={`absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-0 h-0 border-y-6 border-y-transparent border-r-[9px]
            ${status === 'success' ? 'border-green-200' : status === 'error' ? 'border-red-200' : 'border-yellow-200'}
          `} />
          {typeof message === 'string'
            ? message
            : message.map((run, i) => <MascotRunText key={i} run={run} />)}
        </motion.div>
      )}
    </div>
  );
};
