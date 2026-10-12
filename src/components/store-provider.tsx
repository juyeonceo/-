"use client";

import { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import { getProducts } from "@/lib/catalog";
import { CartLine, Product, Variant } from "@/lib/types";

type StoreContextValue = {
  cart: CartLine[]; user: User | null; authLoading: boolean;
  addToCart: (product: Product, variant: Variant, quantity?: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;
  getToken: () => Promise<string | null>;
};

const StoreContext = createContext<StoreContextValue | null>(null);
const storageKey = "fulgere_cart_v1";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    const db = getBrowserSupabase();
    const timer = window.setTimeout(() => {
      try { const saved = localStorage.getItem(storageKey); if (saved) setCart(JSON.parse(saved) as CartLine[]); } catch { /* ignore invalid local cart */ }
      setReady(true);
      if (!db) { setAuthLoading(false); return; }
      db.auth.getUser().then(({ data }) => { setUser(data.user); setAuthLoading(false); });
    }, 0);
    const listener = db?.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === "SIGNED_OUT") { setCart([]); setSyncedUserId(null); }
    });
    return () => { window.clearTimeout(timer); listener?.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (ready) localStorage.setItem(storageKey, JSON.stringify(cart)); }, [cart, ready]);

  useEffect(() => {
    if (!ready || !userId || process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;
    let cancelled = false;
    const db = getBrowserSupabase();
    if (!db) return;
    (async () => {
      const [saved, products] = await Promise.all([
        db.from("cart_items").select("variant_id,quantity").eq("user_id", userId),
        getProducts(),
      ]);
      if (cancelled) return;
      const remote = (saved.data || []).flatMap((item) => {
        const product = products.find((entry) => entry.variants.some((variant) => variant.id === item.variant_id));
        const variant = product?.variants.find((entry) => entry.id === item.variant_id);
        return product && variant ? [{ product, variant, quantity: Math.min(item.quantity, variant.stock) }] : [];
      }).filter((line) => line.quantity > 0);
      setCart((current) => {
        const localIds = new Set(current.map((line) => line.variant.id));
        return [...current, ...remote.filter((line) => !localIds.has(line.variant.id))];
      });
      setSyncedUserId(userId);
    })();
    return () => { cancelled = true; };
  }, [ready, userId]);

  useEffect(() => {
    if (!userId || syncedUserId !== userId || process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;
    const timer = window.setTimeout(() => {
      void getBrowserSupabase()?.rpc("sync_cart", {
        p_lines: cart.map((line) => ({ variantId: line.variant.id, quantity: line.quantity })),
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [cart, userId, syncedUserId]);

  const addToCart = useCallback((product: Product, variant: Variant, quantity = 1) => {
    setCart((current) => {
      const found = current.find((item) => item.variant.id === variant.id);
      if (found) return current.map((item) => item.variant.id === variant.id ? { ...item, quantity: Math.min(item.quantity + quantity, variant.stock) } : item);
      return [...current, { product, variant, quantity: Math.min(quantity, variant.stock) }];
    });
  }, []);
  const updateQuantity = useCallback((variantId: string, quantity: number) => setCart((current) => current.map((item) => item.variant.id === variantId ? { ...item, quantity: Math.max(1, Math.min(quantity, item.variant.stock)) } : item)), []);
  const removeFromCart = useCallback((variantId: string) => setCart((current) => current.filter((item) => item.variant.id !== variantId)), []);
  const clearCart = useCallback(() => setCart([]), []);
  const getToken = useCallback(async () => (await getBrowserSupabase()?.auth.getSession())?.data.session?.access_token || null, []);
  const value = useMemo(() => ({ cart, user, authLoading, addToCart, updateQuantity, removeFromCart, clearCart, getToken }), [cart, user, authLoading, addToCart, updateQuantity, removeFromCart, clearCart, getToken]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
