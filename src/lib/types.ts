export type CategoryId = "all" | "dresses" | "tops" | "trousers" | "knitwear" | "tailoring" | "skirts" | "jumpsuits";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category_id: Exclude<CategoryId, "all">;
  price: number;
  compare_at_price: number | null;
  image_urls: string[];
  badge: string | null;
  is_preorder: boolean;
  preorder_date: string | null;
  one_plus_one: boolean;
  variants: Variant[];
};

export type Variant = { id: string; product_id: string; size: string; color: string; sku: string; stock: number };
export type CartLine = { product: Product; variant: Variant; quantity: number };
export type OrderStatus = "payment_pending" | "paid" | "preorder_waiting" | "preparing" | "shipped" | "delivered" | "cancelled" | "refunded";
export type CustomerOrder = { id: string; status: OrderStatus; total_amount: number; created_at: string; order_items: { id: string; product_name: string; variant_label: string; quantity: number; refunded_quantity: number; line_total: number; image_url: string }[]; shipments?: { carrier: string; tracking_number: string }[] };

export const categories: { id: CategoryId; label: string }[] = [
  { id: "all", label: "전체" }, { id: "dresses", label: "드레스" }, { id: "tops", label: "상의" },
  { id: "trousers", label: "바지" }, { id: "knitwear", label: "니트웨어" }, { id: "tailoring", label: "테일러링" },
  { id: "skirts", label: "스커트" }, { id: "jumpsuits", label: "점프수트" },
];

export const formatWon = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;
export const statusLabel: Record<OrderStatus, string> = { payment_pending: "결제 대기", paid: "결제 완료", preorder_waiting: "입고 대기", preparing: "상품 준비", shipped: "배송 중", delivered: "배송 완료", cancelled: "취소 완료", refunded: "환불 완료" };
