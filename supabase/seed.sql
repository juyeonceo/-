-- Optional preview catalog. Replace these sample products with real FULGERE inventory before launch.
insert into public.products(slug,name,description,category_id,price,image_urls,badge,status,is_preorder,preorder_date,preorder_limit,one_plus_one) values
('sculpted-ivory-suit','스컬프티드 아이보리 수트','선명한 실루엣과 부드러운 결이 만나는 테일러드 셋업.','tailoring',289000,array['/images/ivory-suit.png'],'NEW','active',false,null,0,false),
('oxblood-drape-dress','옥스블러드 드레이프 드레스','움직임에 따라 달라지는 드레이프가 인상적인 미디 드레스.','dresses',198000,array['/images/oxblood-dress.png'],'BEST','active',false,null,0,false),
('charcoal-knit','차콜 소프트 니트','매일의 옷장에 우아하게 스며드는 가벼운 니트.','knitwear',129000,array['/images/charcoal-knit.png'],'NEW','active',false,null,0,false),
('midnight-satin-skirt','미드나잇 새틴 스커트','은은한 광택과 흐르는 듯한 라인의 롱 스커트.','skirts',149000,array['/images/charcoal-knit.png'],null,'active',false,null,0,false),
('atelier-wide-trousers','아틀리에 와이드 트라우저','여유 있는 볼륨과 정교한 허리 라인의 팬츠.','trousers',169000,array['/images/ivory-suit.png'],'PRE-ORDER','active',true,'2026-11-15',100,false),
('draped-ivory-top','드레이프 아이보리 톱','편안하면서도 특별한 날의 분위기를 만드는 드레이프 톱.','tops',119000,array['/images/hero.png'],null,'active',false,null,0,false)
on conflict(slug) do nothing;

insert into public.product_variants(product_id,sku,size,color,stock)
select p.id,'FL-'||upper(substr(replace(p.id::text,'-',''),1,8))||'-'||s.size, s.size,
  case p.slug when 'oxblood-drape-dress' then '옥스블러드' when 'charcoal-knit' then '차콜' when 'midnight-satin-skirt' then '블랙' else '아이보리' end,
  8
from public.products p cross join (values ('S'),('M'),('L')) as s(size)
where p.slug in ('sculpted-ivory-suit','oxblood-drape-dress','charcoal-knit','midnight-satin-skirt','atelier-wide-trousers','draped-ivory-top')
on conflict(sku) do nothing;
