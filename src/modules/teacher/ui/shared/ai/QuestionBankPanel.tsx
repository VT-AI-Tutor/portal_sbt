import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { callAIJson } from "@/modules/ai/application/ai-client";
import { toast } from "sonner";
import { useSaveAiQuestions } from "@/modules/teacher/hooks/useTeacherBank";

type GenQuestion = {
  type: "single_choice" | "true_false" | "fill_blank" | "short_answer";
  question: string;
  options?: string[];
  answer: string;
  difficulty: "easy" | "medium" | "hard";
};

const LABELS: Record<GenQuestion["type"], string> = {
  single_choice: "Tráº¯c nghiá»‡m",
  true_false: "ÄÃºng/Sai",
  fill_blank: "Äiá»n khuyáº¿t",
  short_answer: "Tá»± luáº­n ngáº¯n",
};

const DIFF_COLOR: Record<GenQuestion["difficulty"], string> = {
  easy: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  hard: "bg-destructive/15 text-destructive",
};

export function QuestionBankPanel() {
  const [content, setContent] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<GenQuestion[]>([]);
  const saveAiQuestions = useSaveAiQuestions();

  async function generate() {
    if (content.trim().length < 50) {
      toast.error("CÃ´ dÃ¡n ná»™i dung dÃ i hÆ¡n 50 kÃ½ tá»± nhÃ©!");
      return;
    }
    setLoading(true);
    setQuestions([]);

    const { data, error } = await callAIJson<{ questions: GenQuestion[] }>({
      system:
        "Báº¡n lÃ  chuyÃªn gia thiáº¿t káº¿ cÃ¢u há»i cho há»c sinh tiá»ƒu há»c Viá»‡t Nam, bÃ¡m sÃ¡t chÆ°Æ¡ng trÃ¬nh GDPT 2018. Táº¡o cÃ¢u há»i Ä‘a dáº¡ng loáº¡i vÃ  Ä‘á»™ khÃ³, ngÃ´n ngá»¯ trong sÃ¡ng, phÃ¹ há»£p lá»©a tuá»•i.",
      prompt: `Tá»« ná»™i dung sau, táº¡o ${count} cÃ¢u há»i Ä‘a dáº¡ng (tráº¯c nghiá»‡m, Ä‘Ãºng/sai, Ä‘iá»n khuyáº¿t, tá»± luáº­n ngáº¯n) vá»›i 3 má»©c Ä‘á»™ khÃ³.${topic ? `\nChá»§ Ä‘á»: ${topic}` : ""}\n\nNá»™i dung:\n${content}`,
      tool: {
        name: "generate_questions",
        description: "Táº¡o bá»™ cÃ¢u há»i tá»« tÃ i liá»‡u",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "single_choice",
                      "true_false",
                      "fill_blank",
                      "short_answer",
                    ],
                  },
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  answer: { type: "string" },
                  difficulty: {
                    type: "string",
                    enum: ["easy", "medium", "hard"],
                  },
                },
                required: ["type", "question", "answer", "difficulty"],
              },
            },
          },
          required: ["questions"],
        },
      },
    });

    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (data?.questions?.length) {
      setQuestions(data.questions);
      toast.success(`ÄÃ£ táº¡o ${data.questions.length} cÃ¢u há»i! ðŸŽ‰`);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 border-2 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">
              Chá»§ Ä‘á» (tÃ¹y chá»n)
            </label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="VD: TÃ­nh cháº¥t cá»§a nÆ°á»›c - Khoa há»c 4"
            />
          </div>
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">
              Sá»‘ cÃ¢u ({count})
            </label>
            {/* GAP-100: min/max cá»§a <input> chá»‰ lÃ  gá»£i Ã½ HTML â€” gÃµ tay/dÃ¡n váº«n lá»t. Káº¹p ngay
                trong state (vÃ  cháº·n NaN/rá»—ng) nhÆ° dialog bank Ä‘ang lÃ m. */}
            <Input
              type="number"
              min={3}
              max={30}
              value={count}
              onChange={(e) =>
                setCount(Math.max(3, Math.min(30, Number(e.target.value) || 3)))
              }
            />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">
            Ná»™i dung tÃ i liá»‡u
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="DÃ¡n ná»™i dung SGK, bÃ i giáº£ng..."
            rows={8}
            className="text-sm"
          />
        </div>
        <Button
          onClick={generate}
          disabled={loading}
          className="btn-pop rounded-full px-6 h-11"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 mr-1 animate-spin" /> AI Ä‘ang biÃªn
              soáº¡n...
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-1" /> Táº¡o cÃ¢u há»i
            </>
          )}
        </Button>
      </Card>

      {questions.length > 0 && (
        <div className="space-y-3 animate-pop-in">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">
              {questions.length} cÃ¢u há»i Ä‘Ã£ táº¡o
            </h2>
            {/* GAP-099: lÆ°u cÃ¢u AI vÃ o ngÃ¢n hÃ ng cÃ¢u há»i cá»§a giÃ¡o viÃªn qua Ä‘Æ°á»ng ghi
                /questions/from-ai (má»—i cÃ¢u Ä‘Æ°á»£c sÃ ng an toÃ n AISAFE trÆ°á»›c khi lÆ°u â€” TBANK-R6). */}
            <Button
              variant="outline"
              disabled={saveAiQuestions.isPending}
              className="rounded-full"
              onClick={() =>
                saveAiQuestions.mutate(
                  questions.map((g) => ({
                    question_type: g.type,
                    topic: topic.trim() || g.question.slice(0, 60),
                    difficulty: g.difficulty,
                    question_text: g.question,
                    payload: {
                      options: g.options ?? [],
                      answer: g.answer,
                    },
                  })),
                  {
                    onSuccess: (data) => {
                      toast.success(
                        `ÄÃ£ lÆ°u ${data.saved.length} cÃ¢u vÃ o ngÃ¢n hÃ ng`,
                      );
                      if (data.rejected.length)
                        toast.error(
                          `${data.rejected.length} cÃ¢u bá»‹ bá» do khÃ´ng phÃ¹ há»£p`,
                        );
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {saveAiQuestions.isPending ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" /> Äang lÆ°u...
                </>
              ) : (
                "ðŸ’¾ LÆ°u vÃ o ngÃ¢n hÃ ng"
              )}
            </Button>
          </div>
          {questions.map((q, i) => (
            <Card key={i} className="p-4 border-2">
              <div className="flex items-start gap-3 mb-2">
                <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-info/15 text-info text-xs font-bold">
                      {LABELS[q.type]}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${DIFF_COLOR[q.difficulty]}`}
                    >
                      {q.difficulty === "easy"
                        ? "Dá»…"
                        : q.difficulty === "medium"
                          ? "Vá»«a"
                          : "KhÃ³"}
                    </span>
                  </div>
                  <div className="font-medium">{q.question}</div>
                  {q.options && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {q.options.map((opt, j) => (
                        <li
                          key={j}
                          className={`pl-2 ${opt === q.answer ? "text-success font-bold" : ""}`}
                        >
                          {String.fromCharCode(65 + j)}. {opt}
                          {opt === q.answer && " âœ“"}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!q.options && (
                    <div className="mt-2 text-sm">
                      <span className="text-xs uppercase font-bold text-muted-foreground">
                        ÄÃ¡p Ã¡n:{" "}
                      </span>
                      <span className="text-success font-bold">{q.answer}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
