import { Product } from "./types";

const makeProduct = (id: string, slug: string, name: string, category_id: Product["category_id"], price: number, image: string, badge: string | null, colors: string[], sizes: string[], description: string, extra: Partial<Product> = {}): Product => ({
  id, slug, name, category_id, price, image_urls: [image], badge, description, compare_at_price: null,
  is_preorder: false, preorder_date: null, one_plus_one: false,
  variants: colors.flatMap((color) => sizes.map((size) => ({ id: `${id}-${color}-${size}`, product_id: id, color, size, sku: `FL-${id}-${color}-${size}`, stock: 8 }))),
  ...extra,
});

export const demoProducts: Product[] = [
  makeProduct("look-01", "sculpted-ivory-suit", "스컬프티드 아이보리 수트", "tailoring", 289000, "/images/ivory-suit.png", "NEW", ["아이보리"], ["S", "M", "L"], "선명한 실루엣과 부드러운 결이 만나는 테일러드 셋업. 한 벌로도, 각각으로도 오래 입을 수 있습니다."),
  makeProduct("look-02", "oxblood-drape-dress", "옥스블러드 드레이프 드레스", "dresses", 198000, "/images/oxblood-dress.png", "BEST", ["옥스블러드"], ["S", "M", "L"], "움직임에 따라 달라지는 드레이프가 인상적인 미디 드레스."),
  makeProduct("look-03", "charcoal-knit", "차콜 소프트 니트", "knitwear", 129000, "/images/charcoal-knit.png", "NEW", ["차콜"], ["S", "M", "L"], "매일의 옷장에 우아하게 스며드는 가벼운 니트."),
  makeProduct("look-04", "midnight-satin-skirt", "미드나잇 새틴 스커트", "skirts", 149000, "/images/charcoal-knit.png", null, ["블랙"], ["S", "M", "L"], "은은한 광택과 흐르는 듯한 라인의 롱 스커트."),
  makeProduct("look-05", "atelier-wide-trousers", "아틀리에 와이드 트라우저", "trousers", 169000, "/images/ivory-suit.png", "PRE-ORDER", ["아이보리"], ["S", "M", "L"], "여유 있는 볼륨과 정교한 허리 라인이 균형을 이루는 팬츠.", { is_preorder: true, preorder_date: "2026-11-15" }),
  makeProduct("look-06", "draped-ivory-top", "드레이프 아이보리 톱", "tops", 119000, "/images/hero.png", "1+1", ["아이보리"], ["S", "M", "L"], "편안하면서도 특별한 날의 분위기를 만드는 드레이프 톱.", { one_plus_one: true }),
];
