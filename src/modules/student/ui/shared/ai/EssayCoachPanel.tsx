import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { useState } from "react";
import { Sparkles, Loader2, Lightbulb, CheckCircle2 } from "lucide-react";
import { callAIJson } from '@/modules/ai/application/ai-client';
import { toast } from "sonner";

type Feedback = {
  score: number;
  strengths: string[];
  improvements: string[];
  suggestion: string;
  vocabularyTips: string[];
};

export function EssayCoachPanel() {
  const [prompt, setPrompt] = useState(
    "Em hÃ£y táº£ cáº£nh buá»•i sÃ¡ng trÃªn cÃ¡nh Ä‘á»“ng quÃª em.",
  );
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [fb, setFb] = useState<Feedback | null>(null);

  async function review() {
    if (draft.trim().length < 20) {
      toast.error("Em viáº¿t thÃªm chÃºt ná»¯a rá»“i nhá» AI gÃ³p Ã½ nhÃ©!");
      return;
    }
    setLoading(true);
    setFb(null);

    const { data, error } = await callAIJson<Feedback>({
      system:
        "Báº¡n lÃ  cÃ´ giÃ¡o dáº¡y Tiáº¿ng Viá»‡t cáº¥p tiá»ƒu há»c. HÃ£y Ä‘á»c bÃ i tá»± luáº­n cá»§a há»c sinh vÃ  Ä‘Æ°a ra nháº­n xÃ©t tÃ­ch cá»±c, dá»… hiá»ƒu. Khen Ä‘iá»ƒm máº¡nh trÆ°á»›c, sau Ä‘Ã³ gÃ³p Ã½ nháº¹ nhÃ ng. Tuyá»‡t Ä‘á»‘i khÃ´ng sá»­a thay há»c sinh.",
      prompt: `Äá» bÃ i: ${prompt}\n\nBÃ i lÃ m cá»§a em:\n${draft}\n\nHÃ£y Ä‘Ã¡nh giÃ¡ vÃ  gÃ³p Ã½.`,
      tool: {
        name: "review_essay",
        description: "Cháº¥m vÃ  gÃ³p Ã½ bÃ i tá»± luáº­n tiá»ƒu há»c",
        parameters: {
          type: "object",
          properties: {
            score: { type: "number" },
            strengths: { type: "array", items: { type: "string" } },
            improvements: { type: "array", items: { type: "string" } },
            suggestion: { type: "string" },
            vocabularyTips: { type: "array", items: { type: "string" } },
          },
          required: [
            "score",
            "strengths",
            "improvements",
            "suggestion",
            "vocabularyTips",
          ],
        },
      },
    });

    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (data) {
      setFb(data);
      toast.success("AI Ä‘Ã£ gÃ³p Ã½ xong!");
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 border-2 space-y-4">
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">
            Äá» bÃ i
          </label>
          <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground mb-1 block">
            BÃ i lÃ m cá»§a em
          </label>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Báº¯t Ä‘áº§u viáº¿t bÃ i táº¡i Ä‘Ã¢y..."
            rows={10}
            className="text-base leading-relaxed"
          />
          <div className="text-xs text-muted-foreground mt-1">
            {draft.trim().split(/\s+/).filter(Boolean).length} tá»«
          </div>
        </div>
        <Button
          onClick={review}
          disabled={loading}
          className="btn-pop rounded-full px-6 h-11"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 mr-1 animate-spin" /> AI Ä‘ang Ä‘á»c...
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-1" /> Nhá» AI gÃ³p Ã½
            </>
          )}
        </Button>
      </Card>

      {fb && (
        <div className="space-y-4 animate-pop-in">
          <Card className="p-5 border-2 border-fun bg-gradient-to-br from-fun/10 to-primary/5">
            <div className="flex items-center gap-3">
              <div className="size-16 rounded-full bg-fun text-fun-foreground flex items-center justify-center font-display text-2xl font-bold">
                {fb.score.toFixed(1)}
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-fun">
                  Äiá»ƒm AI
                </div>
                <div className="font-display text-xl font-bold">
                  {fb.score >= 8
                    ? "Tuyá»‡t vá»i!"
                    : fb.score >= 6.5
                      ? "KhÃ¡ tá»‘t"
                      : "Cá»‘ lÃªn nhÃ©!"}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-2 border-success bg-success/5">
            <div className="font-display font-bold text-success mb-2 flex items-center gap-2">
              <CheckCircle2 /> Äiá»ƒm máº¡nh cá»§a em
            </div>
            <ul className="space-y-1.5 text-sm">
              {fb.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-success">âœ“</span> {s}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 border-2 border-warning bg-warning/5">
            <div className="font-display font-bold text-warning mb-2 flex items-center gap-2">
              <Lightbulb className="text-warning" /> CÃ³ thá»ƒ tá»‘t hÆ¡n náº¿u...
            </div>
            <ul className="space-y-1.5 text-sm">
              {fb.improvements.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span>â€¢</span> {s}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 border-2 border-info bg-info/5">
            <div className="font-display font-bold text-info mb-2">
              ðŸ’¡ Gá»£i Ã½ cá»§a CÃ´ AI
            </div>
            <p className="text-sm leading-relaxed">{fb.suggestion}</p>
            {fb.vocabularyTips.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase font-bold text-muted-foreground mb-1">
                  Tá»« ngá»¯ gá»£i Ã½
                </div>
                <div className="flex flex-wrap gap-2">
                  {fb.vocabularyTips.map((v, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-info/15 text-info text-xs font-bold"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
