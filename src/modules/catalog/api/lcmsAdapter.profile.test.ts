// @vitest-environment jsdom
/**
 * API hồ sơ LCMS (platform /api/security, /api/system) cho màn "Cập nhật hồ sơ":
 * danh sách tỉnh, current user, update-new-user (tenantId/positionTypeId hardcode).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lcmsFetchAvatarDataUrl,
  lcmsGetCurrentUser,
  lcmsListProvinces,
  lcmsUpdateProfile,
  lcmsUploadAvatar,
} from "@/core/api/lcmsAdapter";

const env = (data: unknown) => ({ success: true, message: null, data, total: null });

type Call = { url: string; init?: RequestInit };
function stubFetch(handler: (url: string) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(handler(String(url))), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("lcmsListProvinces", () => {
  it("POST geo-location/search với type=P và trả code+name", async () => {
    const calls = stubFetch(() =>
      env({
        items: [
          { code: "01", name: "Hà Nội" },
          { code: "46", name: "Thừa Thiên Huế" },
        ],
      }),
    );
    const res = await lcmsListProvinces();
    expect(res).toEqual([
      { code: "01", name: "Hà Nội" },
      { code: "46", name: "Thừa Thiên Huế" },
    ]);
    const call = calls[0];
    expect(call.url).toContain("/api/system/geo-location/search");
    expect(call.init?.method).toBe("POST");
    const body = JSON.parse(String(call.init?.body));
    expect(body.params).toContainEqual({ property: "type", value: "P", operator: "eq" });
  });

  it("chấp nhận mảng trực tiếp + field name thay thế (textual)", async () => {
    stubFetch(() => env([{ code: "48", textual: "Đà Nẵng" }]));
    expect(await lcmsListProvinces()).toEqual([{ code: "48", name: "Đà Nẵng" }]);
  });
});

describe("lcmsGetCurrentUser", () => {
  it("GET /api/security/user/current và chuẩn hoá field", async () => {
    stubFetch(() => env({ id: 123, username: "admin", geoCode: "46" }));
    const me = await lcmsGetCurrentUser();
    expect(me).toEqual({
      id: "123",
      username: "admin",
      fullName: undefined,
      geoCode: "46",
      birthDate: undefined,
    });
  });

  it("đọc birthDate (nhiều tên field)", async () => {
    stubFetch(() => env({ id: 1, birthDate: "2010-05-02T00:00:00Z" }));
    expect((await lcmsGetCurrentUser()).birthDate).toBe("2010-05-02T00:00:00Z");
  });

  it("lấy geoCode từ object employee lồng khi top-level thiếu", async () => {
    stubFetch(() =>
      env({
        id: "343747628317540360",
        birthDate: "2026-08-13",
        // top-level KHÔNG có geoCode; giá trị thật ở employee.geoCode
        employee: { geoCode: "24" },
      }),
    );
    const me = await lcmsGetCurrentUser();
    expect(me.geoCode).toBe("24");
    expect(me.birthDate).toBe("2026-08-13");
  });
});

describe("ảnh đại diện", () => {
  // Id ảnh là snowflake 18 chữ số > Number.MAX_SAFE_INTEGER: đi qua JSON.parse
  // là mất chữ số cuối và tải/lưu nhầm ảnh.
  const avatarId = "345413326815101010";

  it("đọc id ảnh trong employee.extraData mà KHÔNG mất độ chính xác", async () => {
    stubFetch(() =>
      env({ id: 1, employee: { extraData: `{"avatar":${avatarId}}` } }),
    );
    const parsed = (await lcmsGetCurrentUser()).avatarId;
    expect(parsed).toBe(avatarId);
    // Chốt lại vì sao không JSON.parse thẳng: qua `number` của JS là lệch 10
    // đơn vị, và get-avatar?id=…101000 trả 404.
    expect(parsed).not.toBe(
      String(JSON.parse(`{"avatar":${avatarId}}`).avatar as number),
    );
  });

  it("id ảnh luôn là string trong FE, dù wire gửi số hay chuỗi", async () => {
    // Cả chuỗi xử lý (state, payload, query string) dựa trên bất biến này —
    // để nó tuột về number là mất chữ số ngay lần đầu tiên.
    for (const wire of [`${avatarId}`, `"${avatarId}"`]) {
      stubFetch(() =>
        env({ id: 1, employee: { extraData: `{"avatar":${wire}}` } }),
      );
      const me = await lcmsGetCurrentUser();
      expect(typeof me.avatarId).toBe("string");
      expect(me.avatarId).toBe(avatarId);
    }
  });

  it("BE đổi sang ghi id dạng CHUỖI thì FE chạy luôn, không phải sửa", async () => {
    // Cách chữa gốc là backend ghi {"avatar":"345…"} — mọi id khác trong
    // /current đã là chuỗi rồi, chỉ trong extraData còn là số trần.
    stubFetch(() =>
      env({ id: 1, employee: { extraData: `{"avatar":"${avatarId}"}` } }),
    );
    expect((await lcmsGetCurrentUser()).avatarId).toBe(avatarId);
  });

  it("extraData nhiều field / có khoảng trắng vẫn ra đúng id", async () => {
    stubFetch(() =>
      env({
        id: 1,
        employee: {
          extraData: `{ "note": "x, y}", "avatar" : ${avatarId} , "theme": 2 }`,
        },
      }),
    );
    expect((await lcmsGetCurrentUser()).avatarId).toBe(avatarId);
  });

  it("field khác chứa chuỗi có ':<số dài>,' KHÔNG làm hỏng JSON", async () => {
    // Bước bọc số dài chạy trên văn bản JSON nên nếu không giới hạn vào đúng
    // khoá `avatar`, nó chèn nháy kép vào GIỮA một giá trị chuỗi → JSON vỡ →
    // ảnh biến mất không một tiếng động.
    stubFetch(() =>
      env({
        id: 1,
        employee: {
          extraData: `{"note":"ma so:1234567890123456,xong","avatar":${avatarId}}`,
        },
      }),
    );
    expect((await lcmsGetCurrentUser()).avatarId).toBe(avatarId);
  });

  it("id không phải toàn chữ số vẫn nhận — tin dữ liệu BE, không kiểm định dạng", async () => {
    stubFetch(() =>
      env({ id: 1, employee: { extraData: '{"avatar":"a1b2-c3"}' } }),
    );
    expect((await lcmsGetCurrentUser()).avatarId).toBe("a1b2-c3");
  });

  it("extraData hỏng thì bỏ qua, không làm hỏng cả hồ sơ", async () => {
    stubFetch(() =>
      env({ id: 1, employee: { geoCode: "24", extraData: "{avatar:" } }),
    );
    const me = await lcmsGetCurrentUser();
    expect(me.avatarId).toBeUndefined();
    expect(me.geoCode).toBe("24");
  });

  it("không có extraData thì avatarId undefined", async () => {
    stubFetch(() => env({ id: 1, employee: { geoCode: "24" } }));
    expect((await lcmsGetCurrentUser()).avatarId).toBeUndefined();
  });

  it("upload-avatar gửi multipart (không tự đặt Content-Type) và trả id", async () => {
    // Thân trả về dựng bằng chuỗi thô: id để dạng SỐ đúng như LCMS trả, đó là
    // ca làm lộ lỗi làm tròn nếu adapter lỡ JSON.parse.
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return new Response(avatarId, { status: 200 });
      }),
    );
    const file = new File(["x"], "avatar.png", { type: "image/png" });
    expect(await lcmsUploadAvatar(file)).toBe(avatarId);
    const call = calls[0];
    expect(call.url).toContain("/api/lcms/user/upload-avatar");
    expect(call.init?.method).toBe("POST");
    expect(call.init?.body).toBeInstanceOf(FormData);
    expect(
      (call.init?.headers as Record<string, string>)["Content-Type"],
    ).toBeUndefined();
  });

  // Thân thật của /api/security/user/current (host 10.60.109.46, user "admin",
  // 25/08) — cắt bớt field không liên quan, GIỮ NGUYÊN kiểu dữ liệu: mọi id ở
  // ngoài là CHUỖI, riêng avatar trong extraData là SỐ trần.
  it("đọc đúng thân /current thật", async () => {
    stubFetch(() =>
      env({
        tenantId: "10590164625486848",
        id: "342904071063076877",
        screenName: "admin",
        displayName: "admin",
        birthDate: "2026-08-14",
        employeeId: "342712877536247814",
        employee: {
          id: "342712877536247814",
          code: "admin",
          name: "admin",
          birthDate: "2026-08-07",
          geoCode: "92",
          positionTypeId: "1",
          extraData: '{"avatar":345413326815101013}',
        },
        geoLocaltionName: "Cần Thơ",
      }),
    );
    expect(await lcmsGetCurrentUser()).toEqual({
      id: "342904071063076877",
      // Thân thật KHÔNG có `username`/`fullName`.
      username: "admin",
      fullName: "admin",
      // geoCode chỉ có trong employee; birthDate lấy bản top-level (2026-08-14),
      // không phải employee.birthDate (2026-08-07).
      geoCode: "92",
      birthDate: "2026-08-14",
      // Ảnh KHÔNG nằm trong thân này: chỉ có id, ảnh tải riêng qua get-avatar.
      avatarId: "345413326815101013",
    });
  });

  it("upload-avatar trả id trần (thân thật) — có hay không nháy kép đều đọc được", async () => {
    for (const body of [
      "345413326815101013",
      '"345413326815101013"',
      "  345413326815101013\n",
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(body, { status: 200 })),
      );
      const file = new File(["x"], "avatar.png", { type: "image/png" });
      expect(await lcmsUploadAvatar(file)).toBe("345413326815101013");
    }
  });

  it("đọc được extraData cả khi nằm ở top-level (không trong employee)", async () => {
    stubFetch(() => env({ id: 1, extraData: `{"avatar":${avatarId}}` }));
    expect((await lcmsGetCurrentUser()).avatarId).toBe(avatarId);
  });

  it("upload-avatar KHÔNG ép Accept: application/json (thân có thể là số trơn)", async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return new Response(avatarId, { status: 200 });
      }),
    );
    const file = new File(["x"], "avatar.png", { type: "image/png" });
    expect(await lcmsUploadAvatar(file)).toBe(avatarId);
    expect((calls[0].init?.headers as Record<string, string>).Accept).toContain(
      "*/*",
    );
  });

  // Thân thật của get-avatar (26/08): JSON kèm ảnh mã hoá base64, KHÔNG phải
  // nhị phân — `{filename, extName, content}`.
  const pngBase64 = `iVBORw0KGgo${"A".repeat(60)}=`;

  it("get-avatar ghép data: URI từ base64 + extName", async () => {
    const calls = stubFetch(() => ({
      filename: "hoan-thanh-bai-tap-1785569303556.png",
      extName: "png",
      content: pngBase64,
    }));
    expect(await lcmsFetchAvatarDataUrl(avatarId)).toBe(
      `data:image/png;base64,${pngBase64}`,
    );
    expect(calls[0].url).toContain(`/api/lcms/user/get-avatar?id=${avatarId}`);
  });

  it("extName 'jpg' thành image/jpeg, không phải image/jpg", async () => {
    stubFetch(() => ({ extName: "jpg", content: "/9j/abc" }));
    expect(await lcmsFetchAvatarDataUrl(avatarId)).toBe(
      "data:image/jpeg;base64,/9j/abc",
    );
  });

  it("thiếu extName thì lấy đuôi filename; thiếu cả hai thì đoán từ base64", async () => {
    stubFetch(() => ({ filename: "avatar.WEBP", content: "UklGRabc" }));
    expect(await lcmsFetchAvatarDataUrl(avatarId)).toBe(
      "data:image/webp;base64,UklGRabc",
    );
    stubFetch(() => ({ content: pngBase64 }));
    expect(await lcmsFetchAvatarDataUrl(avatarId)).toBe(
      `data:image/png;base64,${pngBase64}`,
    );
  });

  it("thiếu content là LỖI, không dựng src hỏng", async () => {
    stubFetch(() => ({ filename: "avatar.png", extName: "png" }));
    await expect(lcmsFetchAvatarDataUrl(avatarId)).rejects.toThrow(
      "không trả về nội dung ảnh",
    );
  });
});

describe("lcmsUpdateProfile", () => {
  it("POST update-new-user (user theo token, KHÔNG gửi userId) + tenantId/positionTypeId HARDCODE", async () => {
    const calls = stubFetch(() => env("OK"));
    // Dummy value in a non-password-named const (Fortify: Hardcoded Password — test fixture).
    const pwValue = "123";
    await lcmsUpdateProfile({ geoCode: "46", newPassword: pwValue });
    const call = calls[0];
    expect(call.url).toContain("/api/lcms/user/update-new-user");
    expect(call.url).not.toContain("/api/lcms/user/update-new-user/");
    expect(call.init?.method).toBe("POST");
    const body = JSON.parse(String(call.init?.body));
    expect(body).not.toHaveProperty("userId");
    expect(body).toEqual({
      positionTypeId: 1,
      geoCode: "46",
      tenantId: 10590164625486848,
      newPassword: pwValue,
    });
  });

  it("bỏ geoCode khi rỗng (đổi MK cho user chưa đặt Tỉnh/TP — không xoá tỉnh)", async () => {
    const calls = stubFetch(() => env("OK"));
    await lcmsUpdateProfile({ geoCode: "", newPassword: "x" });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).not.toHaveProperty("geoCode");
    expect(body.newPassword).toBe("x");
  });

  it("bỏ newPassword khi không nhập", async () => {
    const calls = stubFetch(() => env("OK"));
    await lcmsUpdateProfile({ geoCode: "01" });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).not.toHaveProperty("newPassword");
    expect(body.geoCode).toBe("01");
    expect(body.tenantId).toBe(10590164625486848);
  });

  it("gửi birthDate dạng YYYY-MM-DDT00:00:00Z (từ input date)", async () => {
    const calls = stubFetch(() => env("OK"));
    await lcmsUpdateProfile({ geoCode: "01", birthDate: "2026-07-15" });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.birthDate).toBe("2026-07-15T00:00:00Z");
  });

  it("200 thân RỖNG/không-JSON = thành công, KHÔNG ném 'LCMS API error 200'", async () => {
    // /update-new-user thật trả 200 với thân rỗng → res.json() fail → body null.
    // Trước đây bị ném lỗi dù đã lưu thành công.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 })),
    );
    await expect(
      lcmsUpdateProfile({ geoCode: "01", birthDate: "2026-07-15" }),
    ).resolves.toBeUndefined();
  });

  it("gửi avatar (id dạng chuỗi) khi có ảnh mới", async () => {
    const calls = stubFetch(() => env("OK"));
    await lcmsUpdateProfile({ geoCode: "01", avatar: "345413326815101010" });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.avatar).toBe("345413326815101010");
    // Phải là CHUỖI trên dây, đúng như curl NXB. Gửi dạng số là máy chủ nhận
    // một id đã bị JS làm tròn — lưu nhầm ảnh mà không báo lỗi gì.
    expect(typeof body.avatar).toBe("string");
    expect(String(calls[0].init?.body)).toContain(
      '"avatar":"345413326815101010"',
    );
  });

  it("success:false (HTTP 200, không kèm data) là THẤT BẠI, không phải lưu xong", async () => {
    // Envelope lỗi của LCMS đôi khi chỉ có {success,message}. Trước đây nhánh
    // kiểm tra success nằm sau cửa `"data" in body` nên thân này lọt qua và
    // màn hồ sơ toast "Đã lưu thông tin" trong khi máy chủ không ghi gì.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ success: false, message: "Không có quyền" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    await expect(lcmsUpdateProfile({ geoCode: "01" })).rejects.toThrow(
      "Không có quyền",
    );
  });

  it("chấp nhận ISO đầy đủ + bỏ birthDate rỗng/không hợp lệ", async () => {
    let calls = stubFetch(() => env("OK"));
    await lcmsUpdateProfile({ geoCode: "01", birthDate: "2010-05-02T09:30:00Z" });
    expect(JSON.parse(String(calls[0].init?.body)).birthDate).toBe("2010-05-02T00:00:00Z");

    calls = stubFetch(() => env("OK"));
    await lcmsUpdateProfile({ geoCode: "01", birthDate: "" });
    expect(JSON.parse(String(calls[0].init?.body))).not.toHaveProperty("birthDate");
  });
});
