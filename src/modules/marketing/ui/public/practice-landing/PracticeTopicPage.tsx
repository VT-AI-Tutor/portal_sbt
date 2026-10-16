import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getBrand } from "@/core/brand/brand";
import { getSubjectDisplay } from "@/core/reference";
import { Card } from "@/core/ui/card";
import { usePracticeTopic } from "@/modules/catalog/hooks/useCatalog";
import { RegisterDialog } from "@/modules/books/ui/public/RegisterDialog";
import { StudentLoginDialog } from "@/modules/books/ui/public/StudentLoginDialog";
import { COPY } from "./copy";
import { getSubjectIcon } from "./subjectIcons";

/**
 * Chi tiết một bài luyện tập (chủ đề) — trang CÔNG KHAI, mở từ thẻ trên landing.
 *
 * Khách xem được nội dung có gì (các mức nhận thức, số câu khả dụng) nhưng chưa
 * làm bài được: backend chưa có phiên luyện cho khách (GAP-147 Pha 2), nên mọi
 * nút "Luyện N câu" đều mở hộp đăng ký — cùng quy ước Pha 1 của landing.
 */
export function PracticeTopicPage() {
  const { subjectCode = "", level = "", contentCode = "" } = useParams();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const logo = getBrand().logo;

  const query = usePracticeTopic(contentCode, level, subjectCode);
  const subject = getSubjectDisplay(subjectCode);
  const Icon = getSubjectIcon(subjectCode);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            {logo ? (
              <img
                src={logo.src}
                srcSet={logo.srcSet}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                className="h-9 sm:h-10 w-auto"
              />
            ) : (
              <span className="font-display font-bold text-lg text-foreground">
                {COPY.brandShort}
              </span>
            )}
          </Link>
          <div className="flex-1" />
          <button
            type="button"
            className="text-sm font-bold text-foreground hover:text-primary px-2 cursor-pointer"
            onClick={() => setLoginOpen(true)}
          >
            {COPY.loginCta}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft hover:opacity-90 transition cursor-pointer"
            onClick={() => setRegisterOpen(true)}
          >
            {COPY.registerCta}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 w-full">
        <Link
          to="/#bai-tap"
          className="text-sm font-bold text-muted-foreground hover:text-primary no-underline"
        >
          {COPY.topicBack}
        </Link>

        {query.isLoading && (
          <div className="mt-6 space-y-4" aria-hidden>
            <div className="h-10 w-2/3 rounded-xl bg-muted/60 animate-pulse" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 rounded-2xl bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {!query.isLoading && (query.isError || !query.data) && (
          <div className="mt-10 text-center bg-card/40 border-2 border-dashed border-border rounded-3xl p-8 max-w-md mx-auto">
            <div className="text-4xl mb-3" aria-hidden>
              🔍
            </div>
            <h1 className="font-display font-bold text-lg text-foreground">
              {COPY.topicNotFoundTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {COPY.topicNotFoundBody}
            </p>
            <Link
              to="/#bai-tap"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition hover:opacity-90 no-underline"
            >
              {COPY.topicBack}
            </Link>
          </div>
        )}

        {!query.isLoading && !query.isError && query.data && (
          <>
            <div className="mt-4 flex items-start gap-4">
              <div className="hidden sm:flex size-16 rounded-2xl bg-primary/10 items-center justify-center flex-shrink-0">
                <Icon className="size-8 text-primary" aria-hidden />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {subject.label} · Lớp {query.data.level}
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mt-1">
                  {query.data.label}
                </h1>
              </div>
            </div>

            <h2 className="font-display text-xl font-bold text-foreground mt-8">
              {COPY.topicLevelsTitle}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {COPY.topicLevelsHint}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {query.data.levels.map((lv) => (
                <Card key={lv.level_code} className="p-5 border-2">
                  <div className="font-display font-bold text-foreground">
                    {lv.label}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {COPY.topicAvailable(lv.question_available)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegisterOpen(true)}
                    className="mt-4 w-full inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-soft transition hover:opacity-90 cursor-pointer"
                  >
                    {COPY.topicStartCta(lv.suggested_count)}
                  </button>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t-2 border-border bg-card mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          © {COPY.brandShort} · {COPY.slogan}
        </div>
      </footer>

      <RegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <StudentLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
