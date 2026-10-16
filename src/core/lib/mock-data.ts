import type { Lesson, Question } from "./types";
import waterCycleImg from "@/core/assets/water-cycle.jpg";
import waterStatesImg from "@/core/assets/water-states.jpg";

// Mock data dựa trên VBT Khoa học 4 - Tập 1 (NXBGDVNVN)
// Tất cả 23 kiểu tương tác được map vào nội dung sách

export const LESSONS: Lesson[] = [
  {
    id: "all-23",
    topic: "Demo · Đầy đủ 23 dạng câu hỏi",
    title: "Phiếu tổng hợp 23 dạng câu hỏi",
    questions: [
      {
        id: "a23-1",
        type: "single_choice",
        prompt: "1. Nước có tính chất nào sau đây?",
        difficulty: "easy",
        points: 10,
        options: [
          { id: "A", text: "Có hình dạng cố định" },
          { id: "B", text: "Không màu, không mùi, không vị" },
          { id: "C", text: "Có màu xanh" },
          { id: "D", text: "Có mùi thơm" },
        ],
        correct: "B",
      },
      {
        id: "a23-2",
        type: "multiple_choice",
        prompt: "2. Hành động nào giúp bảo vệ nguồn nước? (chọn nhiều)",
        difficulty: "easy",
        points: 15,
        options: [
          { id: "A", text: "Trồng cây quanh hồ" },
          { id: "B", text: "Vứt rác xuống sông" },
          { id: "C", text: "Xử lí nước thải" },
          { id: "D", text: "Đổ dầu mỡ xuống cống" },
        ],
        correct: ["A", "C"],
      },
      {
        id: "a23-3",
        type: "true_false",
        prompt: "3. Đúng / Sai về nước:",
        difficulty: "easy",
        points: 10,
        statements: [
          { id: "s1", text: "Nước có hình dạng cố định.", answer: false },
          { id: "s2", text: "Nước chảy từ cao xuống thấp.", answer: true },
        ],
      },
      {
        id: "a23-4",
        type: "fill_blank",
        prompt: "4. Điền vào chỗ trống.",
        difficulty: "medium",
        points: 15,
        template: "Nước sôi ở {{1}}°C và đóng băng ở {{2}}°C.",
        blanks: [
          { id: "1", answer: "100", suggestions: ["100", "50", "0"] },
          { id: "2", answer: "0", suggestions: ["0", "10", "-10"] },
        ],
      },
      {
        id: "a23-5",
        type: "drag_drop",
        prompt: "5. Kéo các vật vào đúng thể của nước.",
        difficulty: "medium",
        points: 20,
        items: [
          { id: "i1", text: "Đá viên" },
          { id: "i2", text: "Nước trong cốc" },
          { id: "i3", text: "Hơi nước" },
        ],
        zones: [
          { id: "z1", label: "Rắn", accepts: ["i1"] },
          { id: "z2", label: "Lỏng", accepts: ["i2"] },
          { id: "z3", label: "Khí", accepts: ["i3"] },
        ],
      },
      {
        id: "a23-6",
        type: "matching",
        prompt: "6. Nối tính chất với ứng dụng.",
        difficulty: "medium",
        points: 15,
        left: [
          { id: "L1", text: "Nước hoà tan được" },
          { id: "L2", text: "Nước thấm qua vật" },
        ],
        right: [
          { id: "R1", text: "Pha nước muối" },
          { id: "R2", text: "Lau bàn bằng giẻ" },
        ],
        pairs: { L1: "R1", L2: "R2" },
      },
      {
        id: "a23-7",
        type: "ordering",
        prompt: "7. Sắp xếp vòng tuần hoàn nước.",
        difficulty: "medium",
        points: 20,
        items: [
          { id: "o1", text: "Bốc hơi" },
          { id: "o2", text: "Ngưng tụ thành mây" },
          { id: "o3", text: "Mưa rơi" },
          { id: "o4", text: "Chảy về sông biển" },
        ],
        correctAnswer: ["o1", "o2", "o3", "o4"],
      },
      {
        id: "a23-8",
        type: "short_answer",
        prompt: "8. Vì sao cần tiết kiệm nước?",
        difficulty: "medium",
        points: 15,
        sampleAnswer:
          "Vì nước sạch là tài nguyên có hạn và rất cần cho sự sống.",
        keywords: ["tiết kiệm", "tài nguyên", "sự sống"],
      },
      {
        id: "a23-9",
        type: "essay",
        prompt:
          "9. Viết đoạn văn 3-5 câu về việc em đã làm để bảo vệ môi trường.",
        difficulty: "medium",
        points: 20,
        rubric: ["Nêu hành động", "Giải thích lợi ích", "Diễn đạt mạch lạc"],
        minWords: 30,
      },
      {
        id: "a23-10",
        type: "code_input",
        prompt: "10. Viết lệnh Python in ra: Xin chào",
        difficulty: "easy",
        points: 20,
        language: "python",
        starter: "# Viết lệnh print\n",
        expected: 'print("Xin chào")',
      },
      {
        id: "a23-11",
        type: "math_input",
        prompt: "11. 12 + 15 + 14 + 13 = ? (trung bình mỗi số)",
        difficulty: "easy",
        points: 10,
        answer: 13.5,
        unit: "",
      },
      {
        id: "a23-12",
        type: "image_hotspot",
        prompt: "12. Nhấn vào vị trí thể hiện BAY HƠI.",
        difficulty: "medium",
        points: 20,
        imageUrl: waterCycleImg,
        hotspots: [
          { id: "h1", x: 35, y: 55, r: 12, label: "Bay hơi", correct: true },
          { id: "h2", x: 75, y: 25, r: 12, label: "Mưa", correct: false },
        ],
      },
      {
        id: "a23-13",
        type: "kahoot",
        prompt: "13. QUIZ: Cấp gió bão từ?",
        difficulty: "easy",
        points: 20,
        options: [
          { id: "A", text: "Cấp 3", color: "red" },
          { id: "B", text: "Cấp 8 trở lên", color: "blue" },
          { id: "C", text: "Cấp 1", color: "yellow" },
          { id: "D", text: "Cấp 0", color: "green" },
        ],
        correct: "B",
        timeLimit: 20,
      },
      {
        id: "a23-14",
        type: "speed",
        prompt: "14. AI NHANH HƠN: Khi có bão nên?",
        difficulty: "easy",
        points: 30,
        options: [
          { id: "A", text: "Ra ngoài chơi" },
          { id: "B", text: "Ở trong nhà, tránh xa cửa kính" },
          { id: "C", text: "Trèo cây" },
          { id: "D", text: "Đi bơi" },
        ],
        correct: "B",
        timeLimit: 10,
      },
      {
        id: "a23-15",
        type: "flashcard",
        prompt: "15. Flashcard: Sự bay hơi",
        difficulty: "easy",
        points: 10,
        front: "Sự bay hơi",
        back: "Là quá trình nước chuyển từ thể LỎNG sang thể KHÍ.",
      },
      {
        id: "a23-16",
        type: "leaderboard",
        prompt: "16. BXH: Âm thanh nào gây ô nhiễm tiếng ồn?",
        difficulty: "easy",
        points: 15,
        options: [
          { id: "A", text: "Tiếng chim hót" },
          { id: "B", text: "Tiếng nhạc nhẹ" },
          { id: "C", text: "Tiếng máy khoan đường" },
          { id: "D", text: "Tiếng suối chảy" },
        ],
        correct: "C",
      },
      {
        id: "a23-17",
        type: "level",
        prompt: "17. VƯỢT MÀN: Hành trình âm thanh",
        difficulty: "medium",
        points: 50,
        levels: [
          { name: "Màn 1", questionRef: "a23-16" },
          { name: "Màn 2", questionRef: "a23-16" },
          { name: "Màn 3", questionRef: "a23-16" },
        ],
      },
      {
        id: "a23-18",
        type: "puzzle",
        prompt: "18. GHÉP HÌNH: Vòng tuần hoàn nước",
        difficulty: "easy",
        points: 20,
        imageUrl: waterCycleImg,
        pieces: 9,
      },
      {
        id: "a23-19",
        type: "story",
        prompt: "19. Câu chuyện: Buổi sáng của Minh",
        difficulty: "medium",
        points: 25,
        scenes: [
          {
            narrator: "Sáng sớm Minh thắc mắc: vì sao em nhìn thấy mọi vật?",
            choice: {
              options: [
                { id: "A", text: "Vì mắt phát ra ánh sáng" },
                { id: "B", text: "Vì ánh sáng phản xạ từ vật vào mắt" },
              ],
              correct: "B",
            },
          },
          { narrator: "Minh đã hiểu vai trò của ánh sáng!" },
        ],
      },
      {
        id: "a23-20",
        type: "step_hint",
        prompt: "20. Vì sao đun sôi nước thấy hơi bốc lên?",
        difficulty: "hard",
        points: 25,
        question: "Vì sao đun sôi nước ta thấy hơi bốc lên từ ấm?",
        steps: [
          { hint: "Bước 1: Nước sôi ở nhiệt độ nào?", reveal: "100°C" },
          {
            hint: "Bước 2: Nước chuyển sang thể gì?",
            reveal: "Thể khí (hơi nước)",
          },
        ],
        finalAnswer:
          "Hơi nước gặp không khí lạnh ngưng tụ thành giọt nước li ti.",
      },
      {
        id: "a23-21",
        type: "explanation",
        prompt: "21. Không khí có ở đâu?",
        difficulty: "easy",
        points: 10,
        question: "Phát biểu nào ĐÚNG về không khí?",
        options: [
          { id: "A", text: "Chỉ có ngoài trời" },
          { id: "B", text: "Có ở khắp nơi, kể cả trong đất, trong nước" },
          { id: "C", text: "Chỉ khi có gió" },
        ],
        correct: "B",
        detailedExplanation: "Không khí có ở khắp nơi xung quanh chúng ta.",
      },
      {
        id: "a23-22",
        type: "peer_compare",
        prompt: "22. Tính chất nào KHÔNG phải của không khí?",
        difficulty: "medium",
        points: 15,
        options: [
          { id: "A", text: "Không màu, không mùi" },
          { id: "B", text: "Có hình dạng cố định" },
          { id: "C", text: "Có thể bị nén" },
          { id: "D", text: "Trong suốt" },
        ],
        correct: "B",
        peerStats: { A: 8, B: 64, C: 18, D: 10 },
      },
      {
        id: "a23-23",
        type: "adaptive",
        prompt: "23. Câu hỏi thích nghi (Adaptive AI).",
        difficulty: "medium",
        points: 30,
        pool: [
          {
            difficulty: "easy",
            q: {
              id: "a23-ad-e",
              type: "single_choice",
              prompt: "Nước đá có nhiệt độ?",
              options: [
                { id: "A", text: "0°C" },
                { id: "B", text: "100°C" },
                { id: "C", text: "25°C" },
              ],
              correct: "A",
            },
          },
          {
            difficulty: "medium",
            q: {
              id: "a23-ad-m",
              type: "single_choice",
              prompt: "Vật nào dẫn nhiệt tốt nhất?",
              options: [
                { id: "A", text: "Gỗ" },
                { id: "B", text: "Nhựa" },
                { id: "C", text: "Đồng" },
              ],
              correct: "C",
            },
          },
        ],
      },
    ],
  },
  {
    id: "bai-1",
    topic: "Chất",
    title: "Bài 1: Tính chất của nước và nước với cuộc sống",
    questions: [
      {
        id: "b1-q1",
        type: "true_false",
        prompt:
          "Hãy chọn Đ (đúng) hoặc S (sai) cho mỗi phát biểu mô tả tính chất của nước.",
        difficulty: "easy",
        points: 10,
        statements: [
          {
            id: "s1",
            text: "Nước có hình dạng cố định như chai hoặc cốc đựng nước.",
            answer: false,
          },
          {
            id: "s2",
            text: "Nước trong suốt, không màu, không mùi, không vị, không có hình dạng nhất định.",
            answer: true,
          },
          {
            id: "s3",
            text: "Nước có vai trò quan trọng trong đời sống và sản xuất của con người.",
            answer: true,
          },
          {
            id: "s4",
            text: "Nước có thể thấm qua một số vật và hoà tan một số chất.",
            answer: true,
          },
          {
            id: "s5",
            text: "Nước chảy từ cao xuống thấp và chảy lan về khắp mọi phía.",
            answer: true,
          },
        ],
        explanation:
          "Nước là chất lỏng: trong suốt, không màu, không mùi, không vị, KHÔNG có hình dạng cố định mà mang hình dạng của vật chứa; nước chảy từ cao xuống thấp, lan ra khắp mọi phía, thấm qua một số vật (giấy, vải) và hoà tan được một số chất (muối, đường).",
        hint: "Hãy nhớ: vật rắn mới có hình dạng cố định, còn chất lỏng (như nước) sẽ mang hình dạng của bình/cốc chứa nó.",
        whyCorrect:
          "Em đã phân biệt đúng: chai/cốc mới là vật có hình dạng cố định — nước đổ vào chai thì giống chai, đổ vào cốc thì giống cốc. Các phát biểu còn lại đều là tính chất thật sự của nước (chảy, thấm, hoà tan, vai trò trong đời sống).",
        whyWrong:
          "Lỗi thường gặp: nhầm 'hình dạng của vật chứa' thành 'hình dạng của nước'. Nước KHÔNG có hình dạng riêng — nó luôn lấy hình dạng của vật chứa. Hãy thử đổ nước từ cốc sang đĩa: hình dạng nước thay đổi theo vật chứa, chứng tỏ nước không có hình dạng cố định.",
      },
      {
        id: "b1-q2",
        type: "matching",
        prompt:
          "Nối tính chất của nước (cột A) với vận dụng tương ứng (cột B).",
        difficulty: "medium",
        points: 15,
        left: [
          { id: "L1", text: "Nước chảy từ cao xuống thấp" },
          { id: "L2", text: "Nước thấm qua một số vật" },
          { id: "L3", text: "Nước hoà tan một số chất" },
          { id: "L4", text: "Nước chảy lan về khắp mọi phía" },
        ],
        right: [
          { id: "R1", text: "Làm ướt giẻ lau bàn, lau nhà" },
          { id: "R2", text: "Tưới sân cỏ" },
          { id: "R3", text: "Nêm muối, đường vào nước canh" },
          { id: "R4", text: "Úp ngược để cốc mau khô" },
        ],
        pairs: { L1: "R4", L2: "R1", L3: "R3", L4: "R2" },
        explanation:
          "Mỗi tính chất của nước được người ta vận dụng vào một việc cụ thể trong đời sống — hiểu được tính chất sẽ giúp em giải thích được các hiện tượng quen thuộc.",
        hint: "Đọc kĩ động từ ở mỗi việc làm: 'úp ngược' liên quan đến chảy xuống; 'làm ướt giẻ' liên quan đến thấm; 'nêm muối tan ra' liên quan đến hoà tan; 'tưới' khiến nước lan ra cả sân.",
        whyCorrect:
          "Tuyệt vời! Em đã ghép đúng: (1) Úp ngược cốc → nước CHẢY TỪ CAO XUỐNG THẤP nên cốc nhanh khô; (2) Giẻ lau ướt được vì nước THẤM QUA vải; (3) Muối/đường tan vào canh nhờ nước HOÀ TAN; (4) Tưới sân cỏ là nhờ nước CHẢY LAN khắp mọi phía.",
        whyWrong:
          "Cặp ghép phổ biến bị nhầm là 'thấm qua' với 'tưới sân cỏ' — thực ra tưới sân là tận dụng việc nước CHẢY LAN ra khắp mặt sân, còn 'thấm qua' chỉ việc nước ngấm xuyên qua vật (như giẻ thấm nước rồi mới lau được bàn). Hãy đọc lại bảng tính chất ở SGK trang đầu để nhớ rõ.",
      },
      {
        id: "b1-q3",
        type: "single_choice",
        prompt:
          "Dựa vào tính chất nào của nước mà người ta có thể làm chai và cốc đựng nước với nhiều hình dạng khác nhau?",
        difficulty: "easy",
        points: 10,
        options: [
          { id: "A", text: "Nước chảy từ cao xuống thấp" },
          { id: "B", text: "Nước trong suốt, không màu" },
          { id: "C", text: "Nước không có hình dạng cố định" },
          { id: "D", text: "Nước không thấm qua chai và cốc" },
        ],
        correct: "C",
        explanation:
          "Tính chất 'nước không có hình dạng cố định' cho phép nước nhận hình dạng theo bất kì vật chứa nào — đó là lí do người ta có thể thoải mái thiết kế chai, cốc với nhiều kiểu dáng khác nhau (vuông, tròn, dài, cong…).",
        hint: "Câu hỏi nhấn mạnh từ 'NHIỀU HÌNH DẠNG KHÁC NHAU'. Tính chất nào của nước liên quan trực tiếp đến 'hình dạng'?",
        whyCorrect:
          "Chính xác — đáp án C. Vì nước KHÔNG CÓ HÌNH DẠNG CỐ ĐỊNH nên đổ vào bất kì vật nào cũng vừa khít. Nếu nước có hình dạng riêng thì người ta sẽ phải làm chai/cốc đúng theo hình dạng của nước, không thể đa dạng được.",
        whyWrong:
          "Phân tích các đáp án sai:\n• A (chảy từ cao xuống thấp): chỉ giải thích được hướng chuyển động của nước, không liên quan đến hình dạng vật chứa.\n• B (trong suốt, không màu): chỉ là đặc điểm quan sát, không quyết định hình dạng chai/cốc.\n• D (không thấm qua chai/cốc): là lí do chai/cốc giữ được nước, nhưng không giải thích vì sao chai/cốc có nhiều hình dạng.\nĐáp án đúng phải là C — tính chất duy nhất nói về 'hình dạng'.",
      },
      {
        id: "b1-q4",
        type: "fill_blank",
        prompt: "Chọn từ phù hợp để điền vào chỗ trống.",
        difficulty: "medium",
        points: 20,
        template:
          "Khi pha loãng nước rửa bát, ta thấy nước làm loãng và trộn đều chất tẩy rửa. Điều này cho thấy nước có tính chất {{1}}. Khi dùng bọt biển rửa bát, nước có thể {{2}} bọt biển nhưng không thấm qua găng tay.",
        blanks: [
          {
            id: "1",
            answer: "hoà tan một số chất",
            suggestions: [
              "hoà tan một số chất",
              "chảy từ cao xuống thấp",
              "thấm qua một số vật",
            ],
          },
          {
            id: "2",
            answer: "thấm qua",
            suggestions: ["thấm qua", "hoà tan", "chảy lan"],
          },
        ],
        explanation:
          "Nước có thể HOÀ TAN một số chất (muối, đường, xà phòng…) — chất tan biến mất vào trong nước thành dung dịch. Nước cũng THẤM QUA một số vật xốp (bọt biển, vải, giấy) nhưng KHÔNG thấm qua vật không xốp như nhựa, cao su (găng tay).",
        hint: "Chỗ trống 1: nước rửa bát 'tan' đều vào nước → đó là hiện tượng gì? Chỗ trống 2: bọt biển có nhiều lỗ nhỏ giúp nước 'ngấm' vào.",
        whyCorrect:
          "Rất tốt! (1) Chất tẩy rửa tan đều vào nước → đây là tính chất HOÀ TAN MỘT SỐ CHẤT. (2) Bọt biển có nhiều lỗ rỗng nên nước THẤM QUA được; ngược lại găng tay cao su không có lỗ rỗng nên nước không thấm qua, giúp tay khô.",
        whyWrong:
          "Lỗi hay gặp:\n• Điền 'thấm qua' vào chỗ (1) — sai vì 'thấm' nói về việc nước ngấm xuyên vật, còn ở đây nước rửa bát BIẾN MẤT VÀO NƯỚC nên là 'hoà tan'.\n• Điền 'hoà tan' vào chỗ (2) — sai vì bọt biển không tan trong nước; nước chỉ NGẤM (thấm) vào các lỗ của bọt biển.\nMẹo phân biệt: HOÀ TAN = chất biến mất vào nước; THẤM QUA = nước đi xuyên vào vật, vật vẫn còn nguyên.",
      },
      {
        id: "b1-q5",
        type: "short_answer",
        prompt: "Vì sao mặt không còn trơn sau khi được rửa bằng nước?",
        difficulty: "medium",
        points: 15,
        sampleAnswer:
          "Vì nước đã hoà tan và rửa trôi bụi bẩn, dầu nhờn trên mặt.",
        keywords: ["hoà tan", "rửa trôi", "bụi bẩn", "dầu"],
        explanation:
          "Da mặt tiết ra dầu nhờn và bám bụi bẩn → tạo lớp trơn. Khi rửa bằng nước (đặc biệt có sữa rửa mặt), nước hoà tan các chất tan được và cuốn trôi bụi/dầu, nên da khô thoáng và không còn cảm giác trơn.",
        hint: "Nghĩ về 2 việc nước đã làm: (1) làm gì với chất bẩn (hoà tan?) và (2) đưa chất bẩn đi đâu (rửa trôi?).",
        whyCorrect:
          "Câu trả lời hay! Em đã nêu được 2 vai trò của nước: HOÀ TAN bụi bẩn/dầu và RỬA TRÔI chúng khỏi mặt. Đây chính là vận dụng tính chất hoà tan và chảy lan của nước trong đời sống hằng ngày.",
        whyWrong:
          "Câu trả lời chưa đủ ý. Cần nêu được CẢ HAI việc: (1) nước HOÀ TAN bụi bẩn/dầu nhờn trên mặt; (2) nước CHẢY/RỬA TRÔI chúng đi. Nếu chỉ nói 'vì rửa nước' thì chưa giải thích được tính chất nào của nước được vận dụng.",
      },
    ],
  },
  {
    id: "bai-2",
    topic: "Chất",
    title: "Bài 2: Sự chuyển thể của nước và vòng tuần hoàn của nước",
    questions: [
      {
        id: "b2-q1",
        type: "image_hotspot",
        prompt:
          "Nhấn vào vị trí thể hiện quá trình BAY HƠI trong vòng tuần hoàn của nước.",
        difficulty: "medium",
        points: 20,
        imageUrl: waterCycleImg,
        hotspots: [
          { id: "h1", x: 35, y: 55, r: 12, label: "Bay hơi", correct: true },
          { id: "h2", x: 75, y: 25, r: 12, label: "Mưa", correct: false },
          { id: "h3", x: 50, y: 80, r: 12, label: "Sông", correct: false },
        ],
        explanation:
          "Vòng tuần hoàn của nước gồm 4 giai đoạn: BAY HƠI (nước lỏng → hơi) → NGƯNG TỤ (hơi → mây) → MƯA (mây → giọt nước rơi xuống) → CHẢY về sông biển. Bay hơi xảy ra ở mặt nước (sông, hồ, biển) khi được Mặt Trời chiếu nóng.",
        hint: "Bay hơi là quá trình nước CHUYỂN TỪ THỂ LỎNG SANG THỂ KHÍ. Hãy tìm vị trí có mũi tên ĐI LÊN từ mặt nước.",
        whyCorrect:
          "Chính xác! Vị trí em chọn nằm ở mặt nước với mũi tên đi lên — đó là quá trình bay hơi: Mặt Trời làm nước nóng lên, các phân tử nước bay lên không khí thành hơi nước (không nhìn thấy bằng mắt thường).",
        whyWrong:
          "Lỗi thường gặp:\n• Chọn vị trí MƯA (trên cao có giọt nước rơi xuống) — đây là quá trình ngược lại: hơi nước trên mây ngưng tụ thành giọt rồi rơi xuống.\n• Chọn vị trí SÔNG (dưới cùng) — đó là nơi nước CHẢY về, không phải bay hơi.\nMẹo: bay hơi luôn có mũi tên ĐI LÊN từ mặt nước.",
      },
      {
        id: "b2-q2",
        type: "ordering",
        prompt:
          "Sắp xếp các giai đoạn của vòng tuần hoàn nước theo đúng thứ tự.",
        difficulty: "medium",
        points: 20,
        items: [
          { id: "o1", text: "Nước bốc hơi từ sông, biển" },
          { id: "o2", text: "Hơi nước ngưng tụ thành mây" },
          { id: "o3", text: "Mây tạo thành mưa rơi xuống" },
          { id: "o4", text: "Nước mưa chảy về sông, biển" },
        ],
        correctAnswer: ["o1", "o2", "o3", "o4"],
        explanation:
          "Vòng tuần hoàn của nước là một chu trình KHÉP KÍN: Bốc hơi → Ngưng tụ → Mưa → Chảy về sông biển → rồi lại bốc hơi… Cứ thế lặp đi lặp lại không ngừng nên gọi là 'tuần hoàn'.",
        hint: "Bắt đầu từ MẶT TRỜI làm nước nóng. Theo dõi giọt nước đi đâu: dưới đất → bay lên trời → tụ lại → rơi xuống → quay lại sông.",
        whyCorrect:
          "Tuyệt vời! Em đã sắp đúng theo chu trình: (1) Mặt Trời làm nước BỐC HƠI lên cao → (2) Hơi nước gặp lạnh NGƯNG TỤ thành mây → (3) Mây nặng tạo thành MƯA rơi xuống → (4) Nước mưa CHẢY về sông biển, rồi chu trình lặp lại.",
        whyWrong:
          "Sai thứ tự thường gặp: đặt 'mưa' trước 'ngưng tụ thành mây'. Phải có MÂY trước thì mới có MƯA — vì mưa chính là giọt nước từ mây rơi xuống. Hãy nhớ logic: nước phải bay lên cao trước, kết thành mây, rồi mây mới gây ra mưa.",
      },
      {
        id: "b2-q3",
        type: "drag_drop",
        prompt: "Kéo các hiện tượng vào đúng thể của nước.",
        difficulty: "medium",
        points: 20,
        items: [
          { id: "i1", text: "Đá viên" },
          { id: "i2", text: "Nước trong cốc" },
          { id: "i3", text: "Hơi nước bốc lên" },
          { id: "i4", text: "Tuyết" },
          { id: "i5", text: "Nước biển" },
          { id: "i6", text: "Sương mù" },
        ],
        zones: [
          { id: "z1", label: "Thể rắn", accepts: ["i1", "i4"] },
          { id: "z2", label: "Thể lỏng", accepts: ["i2", "i5"] },
          { id: "z3", label: "Thể khí", accepts: ["i3", "i6"] },
        ],
        explanation:
          "Nước tồn tại ở 3 thể: RẮN (cứng, có hình dạng cố định: đá, tuyết, băng) — LỎNG (chảy được, mang hình dạng vật chứa: nước cốc, nước biển, nước mưa) — KHÍ (không nhìn thấy, lan toả: hơi nước, sương mù chính là hơi nước ngưng tụ thành giọt nhỏ li ti lơ lửng).",
        hint: "Hỏi cảm giác sờ vào: cứng → rắn; ướt và chảy được → lỏng; nhẹ, lơ lửng trong không khí → khí.",
        whyCorrect:
          "Chính xác! Đá viên + tuyết là thể RẮN (cứng); Nước cốc + nước biển là thể LỎNG (chảy); Hơi nước + sương mù là thể KHÍ (lơ lửng trong không khí — sương mù chính là rất nhiều giọt nước cực nhỏ tạo thành đám 'mây thấp').",
        whyWrong:
          "Lỗi rất hay gặp: xếp 'sương mù' vào thể LỎNG vì thấy ướt. Thực ra sương mù được tạo từ HƠI NƯỚC ngưng tụ thành giọt cực nhỏ lơ lửng — về bản chất nó nằm trong không khí nên xếp vào thể KHÍ. Tương tự, có em xếp 'tuyết' vào lỏng — sai, tuyết là nước đông cứng nên là thể RẮN.",
      },
      {
        id: "b2-q4",
        type: "flashcard",
        prompt: "Học từ vựng về sự chuyển thể của nước.",
        difficulty: "easy",
        points: 10,
        front: "Sự nóng chảy",
        back: "Là quá trình nước chuyển từ thể RẮN sang thể LỎNG khi được làm nóng (ví dụ: đá tan).",
        explanation:
          "4 quá trình chuyển thể của nước cần nhớ: NÓNG CHẢY (rắn→lỏng), ĐÔNG ĐẶC (lỏng→rắn), BAY HƠI (lỏng→khí), NGƯNG TỤ (khí→lỏng).",
        hint: "Cứ nhớ: 'nóng' → làm tan ra → từ cứng (rắn) thành chảy được (lỏng).",
      },
      {
        id: "b2-q5",
        type: "step_hint",
        prompt: "Vì sao khi đun nước sôi, ta thấy hơi bốc lên?",
        difficulty: "hard",
        points: 25,
        question: "Vì sao khi đun nước sôi, ta thấy hơi bốc lên từ ấm nước?",
        steps: [
          {
            hint: "Bước 1: Khi đun nóng, nhiệt độ nước tăng đến bao nhiêu thì sôi?",
            reveal: "Nước sôi ở 100°C.",
          },
          {
            hint: "Bước 2: Khi đó nước chuyển sang thể nào?",
            reveal: "Nước chuyển từ thể lỏng sang thể khí (hơi nước).",
          },
          {
            hint: "Bước 3: Vì sao ta nhìn thấy 'khói' trắng?",
            reveal:
              "Hơi nước gặp không khí lạnh hơn nên ngưng tụ thành các giọt nước nhỏ li ti.",
          },
        ],
        finalAnswer:
          "Khi đun sôi, nước bay hơi mạnh; hơi nước gặp không khí lạnh hơn ngưng tụ thành các giọt nước li ti, ta nhìn thấy giống như 'khói'.",
        explanation:
          "Hiện tượng 'khói trắng' khi đun nước thực ra KHÔNG PHẢI là hơi nước (hơi nước trong suốt, không nhìn thấy). 'Khói trắng' đó là các GIỌT NƯỚC LI TI — hình thành khi hơi nước gặp không khí lạnh hơn và ngưng tụ lại.",
        whyCorrect:
          "Em hiểu đúng bản chất rồi! Quá trình gồm 2 bước: (1) Nước trong ấm BAY HƠI thành hơi nước (vô hình); (2) Hơi nước thoát ra gặp không khí lạnh ngưng tụ thành giọt nước nhỏ li ti — đó chính là 'khói trắng' mà em nhìn thấy.",
        whyWrong:
          "Sai lầm phổ biến: nghĩ 'khói trắng' chính là hơi nước. Thực ra hơi nước TRONG SUỐT, mắt thường không thấy được. Cái em nhìn thấy là GIỌT NƯỚC NHỎ LI TI do hơi nước ngưng tụ — bản chất đã chuyển lại sang thể lỏng rồi.",
      },
    ],
  },
  {
    id: "bai-3",
    topic: "Chất",
    title: "Bài 3: Bảo vệ nguồn nước và sử dụng nước tiết kiệm",
    questions: [
      {
        id: "b3-q1",
        type: "multiple_choice",
        prompt:
          "Những hành động nào sau đây giúp BẢO VỆ nguồn nước? (chọn nhiều đáp án)",
        difficulty: "easy",
        points: 15,
        options: [
          { id: "A", text: "Vứt rác xuống sông, hồ" },
          { id: "B", text: "Trồng cây xanh quanh hồ" },
          { id: "C", text: "Xử lí nước thải trước khi đổ ra sông" },
          { id: "D", text: "Đổ dầu mỡ xuống cống" },
          { id: "E", text: "Tuyên truyền giữ vệ sinh nguồn nước" },
        ],
        correct: ["B", "C", "E"],
        explanation:
          "Bảo vệ nguồn nước = ngăn không cho chất bẩn, chất độc đi vào nguồn nước, đồng thời tăng cường giữ gìn (trồng cây giữ đất, xử lí nước thải, tuyên truyền). Ngược lại, vứt rác hay đổ dầu mỡ là làm Ô NHIỄM nguồn nước.",
        hint: "Hỏi: hành động này khiến nguồn nước SẠCH HƠN hay BẨN HƠN? Nếu bẩn hơn → loại.",
        whyCorrect:
          "Rất đúng! Em đã chọn đủ B, C, E:\n• B: Trồng cây quanh hồ giúp giữ đất, lọc nước, ngăn xói mòn.\n• C: Xử lí nước thải loại bỏ chất độc trước khi xả ra sông.\n• E: Tuyên truyền giúp mọi người cùng có ý thức bảo vệ.",
        whyWrong:
          "Cần kiểm tra lại:\n• Nếu chọn A (vứt rác xuống sông) hoặc D (đổ dầu mỡ xuống cống) → SAI, vì đó là hành động LÀM Ô NHIỄM nước, không phải bảo vệ.\n• Nếu THIẾU một trong B, C, E → cần chọn thêm vì cả 3 đều là hành động bảo vệ.\nMẹo: chỉ chọn các hành động làm nước SẠCH HƠN.",
      },
      {
        id: "b3-q2",
        type: "math_input",
        prompt:
          "Gia đình Minh dùng hết các tháng: 12, 15, 14, 13 m³ nước. Hỏi trung bình mỗi tháng dùng bao nhiêu m³?",
        difficulty: "medium",
        points: 15,
        answer: 13.5,
        unit: "m³",
        explanation:
          "Trung bình cộng = TỔNG các số ÷ SỐ LƯỢNG số. Ở đây: (12 + 15 + 14 + 13) ÷ 4 = 54 ÷ 4 = 13,5 m³.",
        hint: "Bước 1: cộng cả 4 tháng. Bước 2: chia cho 4 (vì có 4 tháng).",
        whyCorrect:
          "Chính xác 13,5 m³! Em đã làm đúng: 12 + 15 + 14 + 13 = 54, rồi 54 ÷ 4 = 13,5. Biết được mức trung bình giúp gia đình theo dõi và tiết kiệm nước.",
        whyWrong:
          "Lỗi thường gặp:\n• Quên cộng đủ 4 số (chỉ cộng 3) → tổng sai.\n• Chia cho 3 thay vì 4 → có 4 tháng phải chia cho 4.\n• Để kết quả 54 mà quên bước chia.\nHãy làm lại: (12+15+14+13) ÷ 4 = 54 ÷ 4 = 13,5 m³.",
      },
      {
        id: "b3-q3",
        type: "essay",
        prompt:
          "Viết đoạn văn (3-5 câu) nêu một việc em đã làm để tiết kiệm nước.",
        difficulty: "medium",
        points: 20,
        rubric: [
          "Nêu rõ một hành động cụ thể",
          "Giải thích được lợi ích",
          "Diễn đạt mạch lạc, đúng chính tả",
        ],
        minWords: 30,
        explanation:
          "Đoạn văn tốt cần: (1) Câu mở — giới thiệu việc làm (khoá vòi khi đánh răng / hứng nước rửa rau để tưới cây / báo người lớn khi vòi rò…); (2) Câu giữa — mô tả em đã làm như thế nào; (3) Câu kết — nêu lợi ích (tiết kiệm nước, bảo vệ tài nguyên).",
        hint: "Chọn 1 việc CỤ THỂ em từng làm ở nhà → tả lại bằng 3-5 câu → kết bằng 1 câu nêu lợi ích.",
      },
    ],
  },
  {
    id: "bai-4",
    topic: "Chất",
    title: "Bài 4: Không khí có ở đâu?",
    questions: [
      {
        id: "b4-q1",
        type: "explanation",
        prompt: "Không khí có ở đâu trong đời sống quanh ta?",
        difficulty: "easy",
        points: 10,
        question: "Phát biểu nào dưới đây là ĐÚNG về không khí?",
        options: [
          { id: "A", text: "Không khí chỉ có ở ngoài trời" },
          {
            id: "B",
            text: "Không khí có ở khắp mọi nơi, kể cả trong đất, trong nước",
          },
          { id: "C", text: "Không khí chỉ có khi có gió" },
          { id: "D", text: "Không khí chỉ có trong nhà" },
        ],
        correct: "B",
        detailedExplanation:
          "Không khí có ở khắp nơi xung quanh chúng ta — trong nhà, ngoài trời, trong các khe hở của đất và cả hoà tan trong nước. Đó là lí do cá có thể hô hấp được trong nước.",
        hint: "Nghĩ xem: cá thở dưới nước bằng gì? Giun đất sống trong đất nhờ gì để thở? → Không khí có ở những nơi đó!",
        whyCorrect:
          "Đúng rồi — đáp án B! Không khí ở KHẮP MỌI NƠI: trong nhà, ngoài trời, lẫn trong khe đất (giun đất hô hấp được nhờ vậy), hoà tan trong nước (cá hô hấp được nhờ ô-xi tan trong nước). Gió chỉ là không khí chuyển động — không có gió, không khí vẫn ở đó.",
        whyWrong:
          "Phân tích các đáp án sai:\n• A (chỉ ngoài trời): sai, vì trong nhà cũng đầy không khí — em vẫn thở bình thường được trong nhà.\n• C (chỉ khi có gió): sai, gió chỉ là không khí chuyển động; lúc lặng gió không khí vẫn có.\n• D (chỉ trong nhà): sai, ngoài trời rõ ràng có không khí (gió thổi, cây hô hấp).\nĐáp án đúng phải là B — không khí có ở MỌI NƠI.",
      },
      {
        id: "b4-q2",
        type: "peer_compare",
        prompt: "Tính chất nào KHÔNG phải của không khí?",
        difficulty: "medium",
        points: 15,
        options: [
          { id: "A", text: "Không màu, không mùi" },
          { id: "B", text: "Có hình dạng cố định" },
          { id: "C", text: "Có thể bị nén lại" },
          { id: "D", text: "Trong suốt" },
        ],
        correct: "B",
        peerStats: { A: 8, B: 64, C: 18, D: 10 },
        explanation:
          "Không khí là một CHẤT KHÍ nên: trong suốt, không màu, không mùi, không có hình dạng cố định (lấp đầy mọi vật chứa), có thể bị nén (như bơm xe đạp). Tính chất 'có hình dạng cố định' chỉ thuộc về CHẤT RẮN.",
        hint: "Câu hỏi tìm tính chất KHÔNG PHẢI của không khí. Loại bỏ những tính chất em thấy đúng, còn lại là đáp án.",
        whyCorrect:
          "Tuyệt vời! Đáp án B không phải của không khí — vì không khí lấp đầy mọi vật chứa (bóng bay căng tròn, lốp xe vuông cũng đầy không khí). Chỉ chất RẮN mới có hình dạng cố định.",
        whyWrong:
          "Lỗi thường gặp:\n• Chọn A (không màu, không mùi) — sai vì đây ĐÚNG là tính chất của không khí (em không nhìn thấy hay ngửi thấy không khí sạch).\n• Chọn C (bị nén) — sai vì đây cũng đúng (bơm xe nén không khí lại được).\n• Chọn D (trong suốt) — sai vì đây cũng là tính chất đúng.\nCâu hỏi yêu cầu tìm tính chất KHÔNG PHẢI → đáp án B (hình dạng cố định) là đặc điểm của vật rắn, không phải khí.",
      },
    ],
  },
  {
    id: "bai-6",
    topic: "Chất",
    title: "Bài 6: Gió, bão và phòng chống bão",
    questions: [
      {
        id: "b6-q1",
        type: "kahoot",
        prompt: "QUIZ: Cấp gió nào sau đây là cấp BÃO?",
        difficulty: "easy",
        points: 20,
        options: [
          { id: "A", text: "Cấp 3", color: "red" },
          { id: "B", text: "Cấp 8 trở lên", color: "blue" },
          { id: "C", text: "Cấp 1", color: "yellow" },
          { id: "D", text: "Cấp 0", color: "green" },
        ],
        correct: "B",
        timeLimit: 20,
        explanation:
          "Theo thang Bô-pho (Beaufort), gió được chia từ cấp 0 (lặng) đến cấp 17. Từ CẤP 8 trở lên được xem là gió MẠNH có sức tàn phá → gọi là BÃO. Cấp càng cao thì sức gió càng lớn.",
        hint: "Bão là gió rất MẠNH có thể bẻ gãy cành cây, tốc mái nhà — vậy cấp gió phải cao hay thấp?",
        whyCorrect:
          "Đúng rồi — đáp án B! Gió từ CẤP 8 trở lên (tốc độ ≥ 62 km/h) đủ sức quật ngã cây cối, tốc mái nhà → được xếp loại BÃO. Cần theo dõi dự báo và phòng tránh khi nghe có bão.",
        whyWrong:
          "Phân tích:\n• Cấp 0 (D): trời lặng gió, không có gió thổi.\n• Cấp 1 (C): gió rất nhẹ, chỉ làm khói bay nghiêng.\n• Cấp 3 (A): gió nhẹ, làm lá cây xao động.\nCác cấp này quá YẾU để gọi là bão. Bão phải đủ MẠNH để gây thiệt hại → cấp 8 trở lên (B).",
      },
      {
        id: "b6-q2",
        type: "speed",
        prompt: "AI NHANH HƠN: Khi có bão, em nên?",
        difficulty: "easy",
        points: 30,
        options: [
          { id: "A", text: "Ra ngoài chơi" },
          { id: "B", text: "Ở trong nhà, tránh xa cửa kính" },
          { id: "C", text: "Trèo lên cây cao" },
          { id: "D", text: "Đi bơi ngoài biển" },
        ],
        correct: "B",
        timeLimit: 10,
        explanation:
          "Khi bão: gió mạnh có thể làm gãy cây, tốc mái, vỡ cửa kính, sóng biển dâng cao. Vì vậy phải Ở TRONG NHÀ KIÊN CỐ, tránh xa cửa kính (vỡ gây thương tích), không ra biển/sông, không trú dưới cây to.",
        hint: "Hỏi nhanh: nơi nào AN TOÀN nhất khi có gió rất mạnh? Trong nhà chắc chắn hay ngoài trời?",
        whyCorrect:
          "Phản xạ tốt! Đáp án B đúng — ở trong nhà kiên cố, tránh xa cửa kính (vì kính có thể bị gió làm vỡ và gây thương tích). Đây là quy tắc an toàn cơ bản khi có bão.",
        whyWrong:
          "Các đáp án còn lại đều RẤT NGUY HIỂM:\n• A (ra ngoài chơi): có thể bị cây gãy đè, mái tôn bay trúng.\n• C (trèo cây cao): cây có thể đổ; nguy cơ sét đánh.\n• D (đi bơi ngoài biển): sóng to, dòng chảy mạnh có thể cuốn đi.\nLuôn nhớ: KHI BÃO → Ở TRONG NHÀ AN TOÀN.",
      },
    ],
  },
  {
    id: "bai-9",
    topic: "Năng lượng",
    title: "Bài 9: Vai trò của ánh sáng",
    questions: [
      {
        id: "b9-q1",
        type: "story",
        prompt: "Câu chuyện: Bạn Minh đi học buổi sáng",
        difficulty: "medium",
        points: 25,
        scenes: [
          {
            narrator:
              "Sáng sớm, Minh thức dậy. Mặt trời vừa lên. Minh thắc mắc: Vì sao em nhìn thấy mọi vật?",
            choice: {
              options: [
                { id: "A", text: "Vì mắt em phát ra ánh sáng" },
                {
                  id: "B",
                  text: "Vì có ánh sáng từ mặt trời chiếu vào vật rồi phản xạ vào mắt",
                },
                { id: "C", text: "Vì các vật tự sáng" },
              ],
              correct: "B",
            },
          },
          {
            narrator:
              "Đến trường, Minh thấy các bạn đang chăm sóc vườn cây. Cô giáo hỏi: Cây cần ánh sáng để làm gì?",
            choice: {
              options: [
                { id: "A", text: "Để quang hợp tạo thức ăn" },
                { id: "B", text: "Để giữ ấm" },
                { id: "C", text: "Để có màu xanh đẹp" },
              ],
              correct: "A",
            },
          },
          {
            narrator:
              "Tuyệt vời! Minh đã hiểu được vai trò của ánh sáng trong cuộc sống.",
          },
        ],
        explanation:
          "Vai trò của ánh sáng: (1) Giúp ta NHÌN THẤY vật — ánh sáng từ nguồn (mặt trời, đèn) chiếu vào vật rồi PHẢN XẠ vào mắt. (2) Giúp cây xanh QUANG HỢP — biến nước + khí các-bô-níc thành thức ăn (tinh bột) và thải ra ô-xi.",
        hint: "Cảnh 1: thử nhắm mắt — mắt em có 'phát' ra ánh sáng không? Cảnh 2: cây xanh tự tạo ra thức ăn nhờ quá trình gì?",
        whyCorrect:
          "Em hiểu đúng cả 2 vai trò của ánh sáng:\n• Cảnh 1 — B: Mắt KHÔNG tự phát sáng. Ta nhìn thấy nhờ ánh sáng từ mặt trời/đèn chiếu vào vật rồi PHẢN XẠ vào mắt. Ban đêm tắt đèn → tối đen vì không có ánh sáng phản xạ.\n• Cảnh 2 — A: Cây cần ánh sáng để QUANG HỢP, tạo ra thức ăn nuôi cây. Không có ánh sáng → cây vàng úa, chết.",
        whyWrong:
          "Các nhầm lẫn cần tránh:\n• Cảnh 1: 'Mắt phát ra ánh sáng' — sai, đây là quan niệm cổ. Thực tế mắt chỉ NHẬN ánh sáng. 'Vật tự sáng' chỉ đúng với mặt trời, đèn — phần lớn vật khác (bàn, sách, cây) không tự sáng mà chỉ phản xạ ánh sáng.\n• Cảnh 2: 'Để giữ ấm/để có màu xanh đẹp' — sai. Vai trò CHÍNH của ánh sáng với cây là QUANG HỢP (tạo thức ăn). Màu xanh của lá là do chất diệp lục, không phải do ánh sáng tạo ra.",
      },
      {
        id: "b9-q2",
        type: "puzzle",
        prompt: "GHÉP HÌNH: Hoàn thành bức tranh về quang hợp của cây.",
        difficulty: "easy",
        points: 20,
        imageUrl: waterCycleImg,
        pieces: 9,
        explanation:
          "Bức tranh quang hợp gồm: ánh sáng mặt trời chiếu xuống lá → lá nhận khí CO₂ từ không khí và nước từ rễ → tạo ra thức ăn (tinh bột) + thải khí O₂ ra ngoài.",
        hint: "Bắt đầu từ các góc và cạnh ngoài (dễ ghép vì có cạnh thẳng), rồi mới đến phần giữa.",
      },
    ],
  },
  {
    id: "bai-11",
    topic: "Năng lượng",
    title: "Bài 11: Âm thanh trong cuộc sống",
    questions: [
      {
        id: "b11-q1",
        type: "leaderboard",
        prompt: "BẢNG XẾP HẠNG: Âm thanh nào sau đây gây Ô NHIỄM TIẾNG ỒN?",
        difficulty: "easy",
        points: 15,
        options: [
          { id: "A", text: "Tiếng chim hót" },
          { id: "B", text: "Tiếng nhạc nhẹ" },
          { id: "C", text: "Tiếng máy khoan đường" },
          { id: "D", text: "Tiếng suối chảy" },
        ],
        correct: "C",
        explanation:
          "Ô nhiễm tiếng ồn = âm thanh QUÁ TO + KÉO DÀI, gây hại cho sức khoẻ (đau đầu, giảm thính lực, mất ngủ). Các âm thanh nhẹ nhàng từ thiên nhiên (chim, suối) hoặc nhạc nhẹ thì có lợi cho tinh thần.",
        hint: "Âm thanh nào TO, CHÓI, làm em phải bịt tai khi đi qua? Đó là tiếng ồn gây ô nhiễm.",
        whyCorrect:
          "Đúng — đáp án C! Tiếng máy khoan đường rất TO (có thể trên 100 dB), KÉO DÀI nhiều giờ → gây đau tai, đau đầu cho người xung quanh. Đây là một dạng ô nhiễm tiếng ồn phổ biến ở thành phố.",
        whyWrong:
          "Phân tích các đáp án sai:\n• A (chim hót), D (suối chảy): âm thanh thiên nhiên, nhẹ nhàng, dễ chịu — KHÔNG gây ô nhiễm.\n• B (nhạc nhẹ): nếu mở vừa phải thì có lợi cho tinh thần.\nChỉ tiếng máy khoan (C) là âm to + kéo dài → gây hại.",
      },
      {
        id: "b11-q2",
        type: "level",
        prompt: "VƯỢT MÀN: Hành trình âm thanh",
        difficulty: "medium",
        points: 50,
        levels: [
          { name: "Màn 1: Âm thanh là gì?", questionRef: "b11-q1" },
          { name: "Màn 2: Nguồn âm", questionRef: "b11-q1" },
          { name: "Màn 3: Bảo vệ thính giác", questionRef: "b11-q1" },
        ],
        explanation:
          "Để bảo vệ thính giác: tránh nơi có tiếng ồn lớn, đeo tai nghe chống ồn khi cần, không nghe nhạc quá to qua tai nghe, đi khám tai khi thấy ù tai kéo dài.",
        hint: "Mỗi màn áp dụng kiến thức về tiếng ồn — vận dụng câu trả lời ở câu trước.",
      },
    ],
  },
  {
    id: "bai-12",
    topic: "Năng lượng",
    title: "Bài 12: Nhiệt độ và sự truyền nhiệt",
    questions: [
      {
        id: "b12-q1",
        type: "adaptive",
        prompt: "Câu hỏi thích nghi: hệ thống sẽ tăng/giảm độ khó theo bạn.",
        difficulty: "medium",
        points: 30,
        pool: [
          {
            difficulty: "easy",
            q: {
              id: "ad-e1",
              type: "single_choice",
              prompt: "Nước đá có nhiệt độ?",
              options: [
                { id: "A", text: "0°C" },
                { id: "B", text: "100°C" },
                { id: "C", text: "-10°C" },
                { id: "D", text: "25°C" },
              ],
              correct: "A",
            },
          },
          {
            difficulty: "medium",
            q: {
              id: "ad-m1",
              type: "single_choice",
              prompt: "Vật nào dẫn nhiệt TỐT nhất?",
              options: [
                { id: "A", text: "Gỗ" },
                { id: "B", text: "Nhựa" },
                { id: "C", text: "Kim loại đồng" },
                { id: "D", text: "Vải" },
              ],
              correct: "C",
            },
          },
          {
            difficulty: "hard",
            q: {
              id: "ad-h1",
              type: "single_choice",
              prompt: "Vì sao nồi cơm điện thường có thân ngoài bằng nhựa?",
              options: [
                { id: "A", text: "Cho đẹp" },
                { id: "B", text: "Vì nhựa dẫn nhiệt kém, an toàn khi cầm" },
                { id: "C", text: "Vì nhựa rẻ" },
                { id: "D", text: "Vì nhựa dẫn nhiệt tốt" },
              ],
              correct: "B",
            },
          },
        ],
        explanation:
          "Kiến thức nền:\n• Nước ĐÔNG ĐẶC ở 0°C (điểm chuyển từ lỏng sang rắn) — đây là nhiệt độ của nước đá đang tan.\n• KIM LOẠI (đồng, nhôm, sắt) dẫn nhiệt TỐT; gỗ, nhựa, vải dẫn nhiệt KÉM.\n• Người ta dùng vật DẪN NHIỆT KÉM ở những chỗ cần CẦM (tay cầm nồi, vỏ ngoài nồi cơm…) để không bị bỏng.",
        hint: "• Câu dễ: nhiệt độ nước đá đang tan.\n• Câu vừa: vật nào sờ vào lạnh tay nhanh nhất khi để ngoài lạnh? (đó là vật dẫn nhiệt tốt).\n• Câu khó: nghĩ đến mục đích thiết kế — vì sao tay cầm nồi không làm bằng kim loại?",
        whyCorrect:
          "Em trả lời đúng:\n• Easy — A (0°C): nước đá có nhiệt độ 0°C, là nhiệt độ đông đặc/nóng chảy của nước.\n• Medium — C (đồng): kim loại dẫn nhiệt rất tốt, đó là lí do xoong nồi nấu ăn thường làm bằng kim loại.\n• Hard — B (nhựa cách nhiệt): nhựa dẫn nhiệt kém nên thân ngoài nồi cơm không nóng → cầm an toàn không bị bỏng.",
        whyWrong:
          "Các nhầm lẫn cần tránh:\n• Nước đá là 100°C: SAI — 100°C là nhiệt độ nước SÔI; nước đá là 0°C.\n• Gỗ/nhựa/vải dẫn nhiệt tốt: SAI — đây là vật cách nhiệt (dẫn kém), nên người ta dùng làm tay cầm nồi, áo ấm…\n• Vỏ nồi nhựa 'cho đẹp/cho rẻ': chưa đúng trọng tâm — lí do khoa học là nhựa CÁCH NHIỆT giúp AN TOÀN khi cầm.",
      },
    ],
  },
  {
    id: "bai-tin",
    topic: "Tin học (mở rộng)",
    title: "Bài mở rộng: Tin học cơ bản",
    questions: [
      {
        id: "tin-q1",
        type: "code_input",
        prompt: "Viết lệnh Python in ra dòng chữ: Em yêu khoa học",
        difficulty: "easy",
        points: 20,
        language: "python",
        starter: "# Viết lệnh print ở đây\n",
        expected: 'print("Em yêu khoa học")',
        explanation:
          "Trong Python, lệnh print() dùng để in (hiển thị) dữ liệu ra màn hình. Chuỗi văn bản phải đặt trong cặp dấu nháy đơn '...' hoặc nháy kép \"...\".",
        hint: 'Cú pháp: print("nội dung muốn in"). Đừng quên dấu nháy và dấu ngoặc đơn!',
        whyCorrect:
          'Tuyệt vời! Em đã viết đúng cú pháp print("Em yêu khoa học"). Khi chạy lệnh, máy tính sẽ hiển thị đúng dòng chữ này ra màn hình.',
        whyWrong:
          'Lỗi thường gặp:\n• Quên dấu nháy: print(Em yêu khoa học) → Python sẽ báo lỗi vì tưởng là tên biến.\n• Quên dấu ngoặc đơn: print "Em yêu khoa học" → cú pháp Python 3 yêu cầu phải có ().\n• Viết hoa Print/PRINT → Python phân biệt chữ hoa-thường, phải viết thường: print.\n• Sai chính tả nội dung in (thiếu/thừa khoảng trắng).',
      },
    ],
  },
  // ===== TOÁN 4 - Tập 1 (theo VBT Toán 4 - NXBGDVNVN) =====
  {
    id: "toan-bai-1",
    topic: "Toán 4 · Chủ đề 1 · Bài 1",
    title: "Bài 1: Ôn tập các số đến 100 000",
    questions: [
      {
        id: "t1-q1",
        type: "fill_blank",
        prompt: "1. Đọc số rồi viết số thích hợp.",
        difficulty: "easy",
        points: 10,
        template: "Số 'Bốn mươi lăm nghìn hai trăm ba mươi sáu' viết là {{1}}.",
        blanks: [
          {
            id: "1",
            answer: "45236",
            suggestions: ["45236", "45326", "54236"],
          },
        ],
      },
      {
        id: "t1-q2",
        type: "single_choice",
        prompt: "2. Số liền sau của 79 999 là số nào?",
        difficulty: "easy",
        points: 10,
        options: [
          { id: "A", text: "79 998" },
          { id: "B", text: "80 000" },
          { id: "C", text: "80 001" },
          { id: "D", text: "70 000" },
        ],
        correct: "B",
      },
      {
        id: "t1-q3",
        type: "true_false",
        prompt: "3. Đúng ghi Đ, sai ghi S.",
        difficulty: "easy",
        points: 10,
        statements: [
          {
            id: "s1",
            text: "Số 60 504 có chữ số 5 ở hàng trăm.",
            answer: true,
          },
          { id: "s2", text: "Số 99 999 là số có sáu chữ số.", answer: false },
          {
            id: "s3",
            text: "Số 10 000 là số nhỏ nhất có năm chữ số.",
            answer: true,
          },
        ],
      },
      {
        id: "t1-q4",
        type: "ordering",
        prompt: "4. Sắp xếp các số sau theo thứ tự từ bé đến lớn.",
        difficulty: "medium",
        points: 15,
        items: [
          { id: "n1", text: "32 145" },
          { id: "n2", text: "32 154" },
          { id: "n3", text: "32 451" },
          { id: "n4", text: "32 514" },
        ],
        correctAnswer: ["n1", "n2", "n3", "n4"],
      },
      {
        id: "t1-q5",
        type: "math_input",
        prompt:
          "5. Số gồm 4 chục nghìn, 7 nghìn, 2 trăm và 5 đơn vị là số nào?",
        difficulty: "medium",
        points: 15,
        answer: 47205,
        unit: "",
      },
      {
        id: "t1-q6",
        type: "matching",
        prompt: "6. Nối số với cách đọc.",
        difficulty: "medium",
        points: 15,
        left: [
          { id: "L1", text: "25 070" },
          { id: "L2", text: "25 700" },
          { id: "L3", text: "20 507" },
        ],
        right: [
          { id: "R1", text: "Hai mươi lăm nghìn không trăm bảy mươi" },
          { id: "R2", text: "Hai mươi lăm nghìn bảy trăm" },
          { id: "R3", text: "Hai mươi nghìn năm trăm linh bảy" },
        ],
        pairs: { L1: "R1", L2: "R2", L3: "R3" },
      },
      {
        id: "t1-q7",
        type: "fill_blank",
        prompt: "7. Viết số thích hợp vào chỗ chấm.",
        difficulty: "medium",
        points: 15,
        template: "Dãy số tròn nghìn: 12 000; 13 000; {{1}}; 15 000; {{2}}.",
        blanks: [
          {
            id: "1",
            answer: "14000",
            suggestions: ["14000", "14500", "13500"],
          },
          {
            id: "2",
            answer: "16000",
            suggestions: ["16000", "15500", "17000"],
          },
        ],
      },
      {
        id: "t1-q8",
        type: "short_answer",
        prompt: "8. Số lớn nhất có 5 chữ số khác nhau là số nào? Giải thích.",
        difficulty: "hard",
        points: 20,
        sampleAnswer:
          "Số đó là 98 765 vì xếp các chữ số lớn nhất từ trái sang phải.",
        keywords: ["98765", "98 765", "lớn nhất"],
      },
    ],
  },
  {
    id: "toan-bai-4",
    topic: "Toán 4 · Chủ đề 1 · Bài 4",
    title: "Bài 4: Biểu thức chứa chữ",
    questions: [
      {
        id: "t4-q1",
        type: "single_choice",
        prompt: "1. Với a = 5, biểu thức a + 12 có giá trị bằng:",
        difficulty: "easy",
        points: 10,
        options: [
          { id: "A", text: "12" },
          { id: "B", text: "15" },
          { id: "C", text: "17" },
          { id: "D", text: "60" },
        ],
        correct: "C",
      },
      {
        id: "t4-q2",
        type: "math_input",
        prompt: "2. Tính giá trị của biểu thức 3 × b với b = 8.",
        difficulty: "easy",
        points: 10,
        answer: 24,
        unit: "",
      },
      {
        id: "t4-q3",
        type: "fill_blank",
        prompt: "3. Điền số thích hợp.",
        difficulty: "medium",
        points: 15,
        template:
          "Với m = 7 và n = 4, giá trị của m + n là {{1}}; giá trị của m − n là {{2}}.",
        blanks: [
          { id: "1", answer: "11", suggestions: ["11", "10", "12"] },
          { id: "2", answer: "3", suggestions: ["3", "4", "11"] },
        ],
      },
      {
        id: "t4-q4",
        type: "matching",
        prompt: "4. Nối biểu thức với giá trị (với x = 6).",
        difficulty: "medium",
        points: 15,
        left: [
          { id: "L1", text: "x + 9" },
          { id: "L2", text: "x × 4" },
          { id: "L3", text: "20 − x" },
        ],
        right: [
          { id: "R1", text: "15" },
          { id: "R2", text: "24" },
          { id: "R3", text: "14" },
        ],
        pairs: { L1: "R1", L2: "R2", L3: "R3" },
      },
      {
        id: "t4-q5",
        type: "true_false",
        prompt: "5. Đúng ghi Đ, sai ghi S (với a = 10, b = 2).",
        difficulty: "medium",
        points: 15,
        statements: [
          { id: "s1", text: "a + b × 3 = 16", answer: true },
          { id: "s2", text: "(a − b) × 2 = 16", answer: true },
          { id: "s3", text: "a × b + 5 = 30", answer: false },
        ],
      },
      {
        id: "t4-q6",
        type: "math_input",
        prompt: "6. Một hình vuông có cạnh a cm. Tính chu vi khi a = 9.",
        difficulty: "medium",
        points: 15,
        answer: 36,
        unit: "cm",
      },
      {
        id: "t4-q7",
        type: "short_answer",
        prompt: "7. Giải thích vì sao biểu thức a + b = b + a luôn đúng?",
        difficulty: "hard",
        points: 20,
        sampleAnswer:
          "Vì phép cộng có tính chất giao hoán, đổi chỗ các số hạng thì tổng không thay đổi.",
        keywords: ["giao hoán", "đổi chỗ", "tổng"],
      },
    ],
  },
  {
    id: "toan-cd-3",
    topic: "Toán 4 · Chủ đề 3 · Số có nhiều chữ số",
    title: "Phiếu ôn tập Chủ đề 3: Số có nhiều chữ số",
    questions: [
      {
        id: "t3-q1",
        type: "single_choice",
        prompt:
          "1. Số 'Một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy' viết là:",
        difficulty: "easy",
        points: 10,
        options: [
          { id: "A", text: "1 234 567" },
          { id: "B", text: "12 345 67" },
          { id: "C", text: "1 243 567" },
          { id: "D", text: "1 234 657" },
        ],
        correct: "A",
      },
      {
        id: "t3-q2",
        type: "fill_blank",
        prompt: "2. Lớp triệu của số 458 217 309 gồm các chữ số:",
        difficulty: "medium",
        points: 15,
        template:
          "Hàng trăm triệu là {{1}}, hàng chục triệu là {{2}}, hàng triệu là {{3}}.",
        blanks: [
          { id: "1", answer: "4", suggestions: ["4", "5", "8"] },
          { id: "2", answer: "5", suggestions: ["5", "8", "4"] },
          { id: "3", answer: "8", suggestions: ["8", "4", "5"] },
        ],
      },
      {
        id: "t3-q3",
        type: "math_input",
        prompt: "3. Làm tròn số 348 712 đến hàng trăm nghìn.",
        difficulty: "medium",
        points: 15,
        answer: 300000,
        unit: "",
      },
      {
        id: "t3-q4",
        type: "ordering",
        prompt: "4. Sắp xếp theo thứ tự từ lớn đến bé.",
        difficulty: "medium",
        points: 15,
        items: [
          { id: "n1", text: "9 876 543" },
          { id: "n2", text: "10 234 567" },
          { id: "n3", text: "9 876 354" },
          { id: "n4", text: "8 999 999" },
        ],
        correctAnswer: ["n2", "n1", "n3", "n4"],
      },
      {
        id: "t3-q5",
        type: "true_false",
        prompt: "5. Đúng ghi Đ, sai ghi S.",
        difficulty: "medium",
        points: 10,
        statements: [
          { id: "s1", text: "Số 1 000 000 có 7 chữ số.", answer: true },
          { id: "s2", text: "73 806 915 lớn hơn 73 860 519.", answer: false },
          {
            id: "s3",
            text: "Lớp nghìn gồm 3 hàng: nghìn, chục nghìn, trăm nghìn.",
            answer: true,
          },
        ],
      },
      {
        id: "t3-q6",
        type: "matching",
        prompt: "6. Nối số với hàng tương ứng (trong số 56 348 217).",
        difficulty: "medium",
        points: 15,
        left: [
          { id: "L1", text: "Chữ số 5" },
          { id: "L2", text: "Chữ số 3" },
          { id: "L3", text: "Chữ số 2" },
        ],
        right: [
          { id: "R1", text: "Hàng chục triệu" },
          { id: "R2", text: "Hàng trăm nghìn" },
          { id: "R3", text: "Hàng trăm" },
        ],
        pairs: { L1: "R1", L2: "R2", L3: "R3" },
      },
      {
        id: "t3-q7",
        type: "kahoot",
        prompt: "7. ⚡ Quiz nhanh: Số nào lớn nhất?",
        difficulty: "easy",
        points: 20,
        timeLimit: 15,
        options: [
          { id: "A", text: "146 375 490", color: "red" },
          { id: "B", text: "73 806 915", color: "blue" },
          { id: "C", text: "195 402 233", color: "yellow" },
          { id: "D", text: "43 815 709", color: "green" },
        ],
        correct: "C",
      },
      {
        id: "t3-q8",
        type: "short_answer",
        prompt:
          "8. Viết số gồm: 3 trăm triệu, 5 chục triệu, 0 triệu, 4 trăm nghìn, 7 chục nghìn, 2 nghìn, 0 trăm, 1 chục và 6 đơn vị.",
        difficulty: "hard",
        points: 20,
        sampleAnswer: "350 472 016",
        keywords: ["350472016", "350 472 016"],
      },
    ],
  },
  {
    id: "toan-bai-11",
    topic: "Toán 4 · Chủ đề 3 · Bài 11",
    title: "Bài 11: Hàng và lớp",
    questions: [
      {
        id: "t11-q1",
        type: "single_choice",
        prompt: "1. Trong số 836 472, chữ số 8 thuộc hàng nào?",
        difficulty: "easy",
        points: 10,
        options: [
          { id: "A", text: "Hàng nghìn" },
          { id: "B", text: "Hàng chục nghìn" },
          { id: "C", text: "Hàng trăm nghìn" },
          { id: "D", text: "Hàng triệu" },
        ],
        correct: "C",
      },
      {
        id: "t11-q2",
        type: "fill_blank",
        prompt: "2. Viết số thích hợp.",
        difficulty: "easy",
        points: 10,
        template:
          "Số 'Bốn trăm linh năm nghìn hai trăm sáu mươi' viết là {{1}}.",
        blanks: [
          {
            id: "1",
            answer: "405260",
            suggestions: ["405260", "450260", "405026"],
          },
        ],
      },
      {
        id: "t11-q3",
        type: "matching",
        prompt: "3. Nối lớp với các hàng thuộc lớp đó.",
        difficulty: "medium",
        points: 15,
        left: [
          { id: "L1", text: "Lớp đơn vị" },
          { id: "L2", text: "Lớp nghìn" },
          { id: "L3", text: "Lớp triệu" },
        ],
        right: [
          { id: "R1", text: "Đơn vị, chục, trăm" },
          { id: "R2", text: "Nghìn, chục nghìn, trăm nghìn" },
          { id: "R3", text: "Triệu, chục triệu, trăm triệu" },
        ],
        pairs: { L1: "R1", L2: "R2", L3: "R3" },
      },
      {
        id: "t11-q4",
        type: "math_input",
        prompt: "4. Giá trị của chữ số 7 trong số 379 245 là bao nhiêu?",
        difficulty: "medium",
        points: 15,
        answer: 70000,
        unit: "",
      },
      {
        id: "t11-q5",
        type: "true_false",
        prompt: "5. Đúng ghi Đ, sai ghi S.",
        difficulty: "medium",
        points: 15,
        statements: [
          { id: "s1", text: "Mỗi lớp gồm 3 hàng.", answer: true },
          { id: "s2", text: "Số 1 000 000 thuộc lớp nghìn.", answer: false },
          {
            id: "s3",
            text: "Trong 526 814, chữ số 2 có giá trị là 20 000.",
            answer: true,
          },
        ],
      },
      {
        id: "t11-q6",
        type: "ordering",
        prompt: "6. Sắp xếp các hàng từ bé đến lớn.",
        difficulty: "easy",
        points: 10,
        items: [
          { id: "h1", text: "Đơn vị" },
          { id: "h2", text: "Trăm" },
          { id: "h3", text: "Nghìn" },
          { id: "h4", text: "Trăm nghìn" },
        ],
        correctAnswer: ["h1", "h2", "h3", "h4"],
      },
      {
        id: "t11-q7",
        type: "short_answer",
        prompt:
          "7. Hãy viết số gồm 6 trăm nghìn, 0 chục nghìn, 4 nghìn, 2 trăm, 5 chục và 1 đơn vị.",
        difficulty: "hard",
        points: 20,
        sampleAnswer: "604 251",
        keywords: ["604251", "604 251"],
      },
    ],
  },
  // ============================================================
  // TIẾNG VIỆT LỚP 1 — Bài 20: Ôn tập (theo VBT Tiếng Việt 1, tập 1)
  // ============================================================
  {
    id: "tv1-bai-20",
    topic: "Tiếng Việt 1 · Tập 1",
    title: "Bài 20: Ôn tập (Tiếng Việt lớp 1)",
    questions: [
      {
        id: "tv1b20-q1",
        type: "matching",
        prompt:
          "1. Nối từ ngữ ở cột A với từ ngữ ở cột B để tạo thành câu đúng. Đọc to câu em vừa tạo nhé!",
        difficulty: "easy",
        points: 15,
        left: [
          { id: "L1", text: "Mẹ" },
          { id: "L2", text: "Nghé và bê" },
          { id: "L3", text: "Nụ cà" },
        ],
        right: [
          { id: "R1", text: "ghé nhà bà." },
          { id: "R2", text: "có cỏ." },
          { id: "R3", text: "nho nhỏ." },
        ],
        pairs: { L1: "R1", L2: "R2", L3: "R3" },
        explanation:
          "Mỗi câu cần một CHỦ NGỮ (ai, cái gì) đi với một VỊ NGỮ (làm gì, như thế nào) sao cho có nghĩa: Mẹ ghé nhà bà. — Nghé và bê có cỏ. — Nụ cà nho nhỏ.",
        hint: "Hãy đọc thử từng cặp xem có nghĩa không. Ví dụ 'Mẹ có cỏ' nghe lạ tai → chưa đúng. 'Mẹ ghé nhà bà' mới có nghĩa.",
        whyCorrect:
          "Tuyệt vời! 🐝 Em đã nối đúng cả 3 câu: (1) MẸ — ghé nhà bà (mẹ là người, đi thăm bà); (2) NGHÉ VÀ BÊ — có cỏ (nghé/bê là con vật, ăn cỏ); (3) NỤ CÀ — nho nhỏ (nụ cà là vật, nho nhỏ là tả hình dáng). Ong chăm chỉ lắc lư khen em đó!",
        whyWrong:
          "Bạn ong chăm chỉ lắc đầu rồi: 'Bạn hãy làm lại nhé!' 🐝\nLỗi hay gặp:\n• Nối 'Mẹ — có cỏ' → Mẹ là người, không ăn cỏ. 'Có cỏ' phải đi với con vật ăn cỏ (nghé, bê).\n• Nối 'Nụ cà — ghé nhà bà' → nụ cà là vật, không tự đi thăm ai được.\nMẹo: Đọc to câu vừa nối lên — nếu nghe LẠ TAI thì chắc là sai rồi.",
      },
      {
        id: "tv1b20-q2",
        type: "multiple_choice",
        prompt:
          "2. Trò chơi 'Chỉ đường cho bé' 🌸 — Bé muốn hái những bông hoa có chữ VIẾT ĐÚNG để tặng bà. Em hãy chọn TẤT CẢ những bông hoa viết đúng nhé!",
        difficulty: "medium",
        points: 25,
        options: [
          { id: "A", text: "🌼 gà giò" },
          { id: "B", text: "🌸 lá nghệ" },
          { id: "C", text: "🌺 ghẹ đỏ" },
          { id: "D", text: "🌻 ngã ba" },
          { id: "E", text: "🌷 bẹ ngô" },
          { id: "F", text: "🥀 gà ghò" },
          { id: "G", text: "🥀 lá ngệ" },
          { id: "H", text: "🥀 ngẽ đỏ" },
        ],
        correct: ["A", "B", "C", "D", "E"],
        explanation:
          "QUY TẮC chính tả gh / ngh: chữ 'gh' và 'ngh' chỉ đứng trước i, e, ê. Chữ 'g' và 'ng' đứng trước các nguyên âm còn lại (a, o, ô, ơ, u, ư).",
        hint: "Hãy nhớ: g-h (và ng-h) đi với 3 nguyên âm i, e, ê. Còn lại dùng 'g' và 'ng'. Ví dụ: ghế (đi với ê → có h), gà (đi với a → không có h).",
        whyCorrect:
          "Bông hoa nở rực rỡ! 🌸✨ Em đã chọn đúng 5 bông hoa: gà giò, lá nghệ, ghẹ đỏ, ngã ba, bẹ ngô. Em đã thuộc bài quy tắc 'g/gh' và 'ng/ngh' rồi đó. Tiếng 'ting' vang lên — bé đã đến nhà bà tặng hoa thành công!",
        whyWrong:
          "Tiếng 'rè' vang lên 🚨 — bông hoa em chọn bị héo rồi!\nNhững từ VIẾT SAI:\n• 'gà ghò' → sai vì sau 'g' là 'o' nên không cần 'h' → đúng phải là 'gà giò'.\n• 'lá ngệ' → sai vì sau 'ng' là 'ê' nên phải có 'h' → đúng là 'lá nghệ'.\n• 'ngẽ đỏ' → sai vì sau 'ng' là 'e' nên phải có 'h' → đúng là 'ghẹ đỏ' (con ghẹ).\nQUY TẮC VÀNG cần nhớ: gh / ngh CHỈ đi với 3 chữ i, e, ê. Em hãy đọc lại và thử lại nhé!",
      },
      {
        id: "tv1b20-q3",
        type: "fill_blank",
        prompt:
          "3. Em hãy điền 'g' hoặc 'gh' vào chỗ trống cho đúng chính tả nhé.",
        difficulty: "easy",
        points: 15,
        template:
          "Bà cho bé cái {{1}}ế. — Mẹ {{2}}é nhà bà. — Bé ăn {{3}}ạo nếp.",
        blanks: [
          { id: "1", answer: "gh", suggestions: ["g", "gh"] },
          { id: "2", answer: "gh", suggestions: ["g", "gh"] },
          { id: "3", answer: "g", suggestions: ["g", "gh"] },
        ],
        explanation:
          "Quy tắc: gh đứng trước i, e, ê; g đứng trước a, o, ô, ơ, u, ư. Vì vậy: ghế (trước ê → gh), ghé (trước e → gh), gạo (trước a → g).",
        hint: "Nhìn vào CHỮ NGAY SAU chỗ trống: nếu là i, e, ê → dùng 'gh'; nếu là a, o, ô, ơ, u, ư → dùng 'g'.",
        whyCorrect:
          "Chính xác! 🎉 (1) gh-ế → vì sau là 'ê'; (2) gh-é → vì sau là 'e'; (3) g-ạo → vì sau là 'a'. Em đã nắm vững quy tắc rồi!",
        whyWrong:
          "Sai rồi nhé. Cách kiểm tra rất đơn giản:\n• 'ghế' — chữ sau là 'ê' → bắt buộc dùng 'gh'.\n• 'ghé' — chữ sau là 'e' → bắt buộc dùng 'gh'.\n• 'gạo' — chữ sau là 'a' → KHÔNG được thêm 'h', chỉ dùng 'g'.\nNhớ câu thần chú: 'GH đi với I, E, Ê — còn lại dùng G nhé!'",
      },
      {
        id: "tv1b20-q4",
        type: "single_choice",
        prompt: "4. Câu nào dưới đây viết ĐÚNG chính tả?",
        difficulty: "easy",
        points: 10,
        options: [
          { id: "A", text: "Bé ngĩ về bà." },
          { id: "B", text: "Bé nghĩ về bà." },
          { id: "C", text: "Bé ngĩh về bà." },
          { id: "D", text: "Bé nghỉ về bà." },
        ],
        correct: "B",
        explanation:
          "Chữ 'nghĩ' bắt đầu bằng 'ngh' vì đứng trước nguyên âm 'i'. Quy tắc: ngh + i/e/ê.",
        hint: "Sau âm đầu là chữ 'i' → cần dùng 'ngh' (có h), không dùng 'ng'.",
        whyCorrect:
          "Đúng rồi! 🎉 'Bé nghĩ về bà.' — 'nghĩ' viết với 'ngh' vì đứng trước 'i'. Câu cũng có nghĩa rõ ràng: bé đang nhớ tới bà.",
        whyWrong:
          "Phân tích các đáp án sai:\n• A 'ngĩ' — SAI chính tả, thiếu 'h' (vì trước 'i' phải là 'ngh').\n• C 'ngĩh' — SAI vị trí của 'h', 'h' phải đứng ngay sau 'ng' chứ không đứng cuối.\n• D 'nghỉ' — viết đúng chính tả nhưng SAI NGHĨA: 'nghỉ' là không làm việc, không hợp với 'về bà'.\nĐáp án đúng là B 'nghĩ' = suy nghĩ, nhớ về.",
      },
      {
        id: "tv1b20-q5",
        type: "true_false",
        prompt:
          "5. Bạn ong chăm chỉ đố em: Đúng (Đ) hay Sai (S) cho mỗi cách viết sau đây?",
        difficulty: "medium",
        points: 15,
        statements: [
          { id: "s1", text: "'ghi bài' viết đúng chính tả.", answer: true },
          { id: "s2", text: "'gế ngồi' viết đúng chính tả.", answer: false },
          { id: "s3", text: "'nghe nhạc' viết đúng chính tả.", answer: true },
          { id: "s4", text: "'ngà voi' viết đúng chính tả.", answer: true },
          { id: "s5", text: "'nghà bà' viết đúng chính tả.", answer: false },
        ],
        explanation:
          "Quy tắc gh/ngh + i, e, ê — và g/ng + a, o, ô, ơ, u, ư. Áp dụng quy tắc để xét từng từ: ghi (trước i → gh ✓), gế (trước ê → phải là 'ghế' ✗), nghe (trước e → ngh ✓), ngà (trước a → ng ✓), nghà (trước a → phải là 'nhà' hoặc 'ngà', không có 'nghà' ✗).",
        hint: "Mỗi từ em hãy nhìn CHỮ NGAY SAU 'g' hoặc 'ng'. Nếu là i, e, ê thì cần thêm 'h'; nếu là a, o, ô… thì KHÔNG có 'h'.",
        whyCorrect:
          "Bạn ong chăm chỉ lắc lư khen em! 🐝🎉 Em đã phân biệt rất chính xác g/gh và ng/ngh. Đây là quy tắc chính tả quan trọng nhất của Tiếng Việt lớp 1 đó.",
        whyWrong:
          "Bạn ong chăm chỉ lắc đầu: 'Bạn hãy làm lại nhé!' 🐝\nGiải thích từng câu:\n• 'ghi bài' ĐÚNG (ghi → trước i → có h).\n• 'gế ngồi' SAI — trước 'ê' phải dùng 'gh', viết đúng là 'ghế ngồi'.\n• 'nghe nhạc' ĐÚNG (nghe → trước e → có h).\n• 'ngà voi' ĐÚNG (ngà → trước a → không h).\n• 'nghà bà' SAI — trước 'a' không được dùng 'ngh'; từ đúng là 'nhà bà' (chữ 'nh' khác với 'ngh').",
      },
      {
        id: "tv1b20-q6",
        type: "single_choice",
        prompt: "🐝 Tự đánh giá: Sau bài ôn tập này, em cảm thấy thế nào?",
        difficulty: "easy",
        points: 5,
        options: [
          { id: "A", text: "⭐ Em chưa hiểu lắm, muốn học lại." },
          { id: "B", text: "⭐⭐ Em đã hiểu một phần, cần luyện thêm." },
          { id: "C", text: "⭐⭐⭐ Em hiểu rất rõ và làm được hết!" },
        ],
        correct: "C",
        explanation:
          "Đây là phần TỰ ĐÁNH GIÁ — không có đáp án đúng/sai tuyệt đối. Em hãy chọn ngôi sao thể hiện đúng cảm nhận của mình. Dù em chọn ngôi sao nào, ong chăm chỉ vẫn luôn ở bên em! 🐝💛",
        hint: "Hãy chọn theo CẢM NHẬN THẬT của em, không cần ngại nhé. Nếu chưa hiểu, em có thể quay lại học cùng cô và bạn ong.",
        whyCorrect:
          "Tuyệt vời! ⭐⭐⭐ Em đã làm rất tốt bài ôn tập. Bạn ong chăm chỉ lắc lư vui mừng cùng em! Hãy tiếp tục giữ tinh thần học vui vẻ này nhé! 🐝🎉",
        whyWrong:
          "Không sao cả! Cô và bạn ong chăm chỉ luôn ở đây giúp em. Em hãy nghỉ một chút, sau đó quay lại làm bài 1 và bài 2 thêm một lần nữa — chắc chắn lần này em sẽ giỏi hơn nhiều! 🐝💪",
      },
    ],
  },
];

export const ALL_QUESTIONS: Question[] = LESSONS.flatMap((l) => l.questions);

export function getQuestion(id: string): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}
