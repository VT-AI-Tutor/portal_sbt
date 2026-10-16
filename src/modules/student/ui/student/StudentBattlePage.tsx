import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Swords, Users, Crown, Zap } from "lucide-react";

export function StudentBattlePage() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Swords className="text-fun" /> Thi đấu
          </h1>
          <p className="text-muted-foreground">
            Tham gia trận đấu real-time với bạn bè
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-2 border-fun bg-gradient-to-br from-fun/10 to-card">
            <Zap className="text-fun size-10 mb-2 animate-pulse" />
            <div className="font-display text-xl font-bold">Auto Match</div>
            <div className="text-sm text-muted-foreground">
              Ghép phòng nhanh với 4 bạn ngẫu nhiên
            </div>
            <Button className="btn-pop w-full mt-4 rounded-full h-12">
              Tham gia ngay ⚡
            </Button>
          </Card>
          <Card className="p-6 border-2 border-info bg-gradient-to-br from-info/10 to-card">
            <Users className="text-info size-10 mb-2" />
            <div className="font-display text-xl font-bold">
              Tạo phòng riêng
            </div>
            <div className="text-sm text-muted-foreground">
              Mời bạn cùng lớp bằng mã PIN
            </div>
            <Button variant="outline" className="w-full mt-4 rounded-full h-12">
              Tạo phòng
            </Button>
          </Card>
        </div>

        <Card className="p-5 border-2">
          <div className="font-display font-bold text-lg flex items-center gap-2 mb-3">
            <Crown className="text-warning" /> Phòng đang mở
          </div>
          <div className="space-y-2">
            {[
              { name: "Lớp 4A · Khoa học", players: "12/20", host: "Cô Lan" },
              { name: "Toán cơ bản", players: "5/8", host: "Minh Anh" },
              { name: "Vòng tuần hoàn nước", players: "3/4", host: "Nam" },
            ].map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between p-3 rounded-xl border-2 hover:border-primary"
              >
                <div>
                  <div className="font-bold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Chủ phòng: {r.host} · {r.players} người
                  </div>
                </div>
                <Button size="sm" className="btn-pop rounded-full">
                  Vào phòng
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
  );
}
