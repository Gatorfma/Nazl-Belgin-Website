begin;

insert into public.artworks
  (id, slug, title, year, series, medium, dimensions, legacy_path,
   aspect_width, aspect_height, sort_order, published)
values
  ('10000000-0000-4000-8000-000000000001','sweet-devil','My Sweet Devil',2025,'Monsters','Oil on canvas','60 × 60 cm','art/sweet-devil.jpg',1995,2000,0,true),
  ('10000000-0000-4000-8000-000000000002','darwin','Darwin Was Just Guessing',2025,'Evolution','Oil on canvas','100 × 81 cm','art/darwin.jpg',1667,2000,1,true),
  ('10000000-0000-4000-8000-000000000003','too-horny','Too Horny to Die',2025,'Monsters','Oil and oil stick on canvas','25 × 25 cm','art/too-horny.jpg',1952,1892,2,true),
  ('10000000-0000-4000-8000-000000000004','monsters-4880',null,null,'Monsters',null,null,'art/monsters-4880.jpg',1643,2000,3,true),
  ('10000000-0000-4000-8000-000000000005','monsters-4914',null,null,'Monsters',null,null,'art/monsters-4914.jpg',1530,2000,4,true),
  ('10000000-0000-4000-8000-000000000006','monsters-4915',null,null,'Monsters',null,null,'art/monsters-4915.jpg',1547,2000,5,true),
  ('10000000-0000-4000-8000-000000000007','monsters-4917',null,null,'Monsters',null,null,'art/monsters-4917.jpg',2000,1997,6,true),
  ('10000000-0000-4000-8000-000000000008','monsters-4921',null,null,'Monsters',null,null,'art/monsters-4921.jpg',1485,2000,7,true),
  ('10000000-0000-4000-8000-000000000009','monsters-4940',null,null,'Monsters',null,null,'art/monsters-4940.jpg',1579,2000,8,true),
  ('10000000-0000-4000-8000-000000000010','monsters-4943',null,null,'Monsters',null,null,'art/monsters-4943.jpg',1984,2000,9,true),
  ('10000000-0000-4000-8000-000000000011','monsters-4945',null,null,'Monsters',null,null,'art/monsters-4945.jpg',2000,1998,10,true),
  ('10000000-0000-4000-8000-000000000012','monsters-4946',null,null,'Monsters',null,null,'art/monsters-4946.jpg',1952,2000,11,true),
  ('10000000-0000-4000-8000-000000000013','monsters-4947',null,null,'Monsters',null,null,'art/monsters-4947.jpg',1966,2000,12,true),
  ('10000000-0000-4000-8000-000000000014','monsters-4948',null,null,'Monsters',null,null,'art/monsters-4948.jpg',1979,2000,13,true),
  ('10000000-0000-4000-8000-000000000015','monsters-4949',null,null,'Monsters',null,null,'art/monsters-4949.jpg',1955,2000,14,true),
  ('10000000-0000-4000-8000-000000000016','monsters-4950',null,null,'Monsters',null,null,'art/monsters-4950.jpg',1983,2000,15,true),
  ('10000000-0000-4000-8000-000000000017','monsters-4951',null,null,'Monsters',null,null,'art/monsters-4951.jpg',1991,2000,16,true),
  ('10000000-0000-4000-8000-000000000018','monsters-4952',null,null,'Monsters',null,null,'art/monsters-4952.jpg',2000,1986,17,true),
  ('10000000-0000-4000-8000-000000000019','monsters-4953',null,null,'Monsters',null,null,'art/monsters-4953.jpg',1996,2000,18,true),
  ('10000000-0000-4000-8000-000000000020','monsters-4955',null,null,'Monsters',null,null,'art/monsters-4955.jpg',1962,2000,19,true),
  ('10000000-0000-4000-8000-000000000021','monsters-4956',null,null,'Monsters',null,null,'art/monsters-4956.jpg',2000,1974,20,true),
  ('10000000-0000-4000-8000-000000000022','monsters-4957',null,null,'Monsters',null,null,'art/monsters-4957.jpg',2000,1928,21,true),
  ('10000000-0000-4000-8000-000000000023','monsters-4958',null,null,'Monsters',null,null,'art/monsters-4958.jpg',1606,2000,22,true),
  ('10000000-0000-4000-8000-000000000024','evolution-1861',null,null,'Evolution',null,null,'art/evolution-1861.jpg',1591,2000,23,true),
  ('10000000-0000-4000-8000-000000000025','evolution-1862',null,null,'Evolution',null,null,'art/evolution-1862.jpg',1569,2000,24,true),
  ('10000000-0000-4000-8000-000000000026','evolution-1863',null,null,'Evolution',null,null,'art/evolution-1863.jpg',1740,1770,25,true),
  ('10000000-0000-4000-8000-000000000027','evolution-1866',null,null,'Evolution',null,null,'art/evolution-1866.jpg',2000,1973,26,true),
  ('10000000-0000-4000-8000-000000000028','evolution-1867',null,null,'Evolution',null,null,'art/evolution-1867.jpg',1980,2000,27,true),
  ('10000000-0000-4000-8000-000000000029','evolution-1868',null,null,'Evolution',null,null,'art/evolution-1868.jpg',1970,2000,28,true),
  ('10000000-0000-4000-8000-000000000030','evolution-1869',null,null,'Evolution',null,null,'art/evolution-1869.jpg',1926,1948,29,true),
  ('10000000-0000-4000-8000-000000000031','stone-hills-1849',null,null,'Stone Hills',null,null,'art/stone-hills-1849.jpg',1599,2000,30,true),
  ('10000000-0000-4000-8000-000000000032','stone-hills-1850',null,null,'Stone Hills',null,null,'art/stone-hills-1850.jpg',1683,2000,31,true),
  ('10000000-0000-4000-8000-000000000033','stone-hills-1852',null,null,'Stone Hills',null,null,'art/stone-hills-1852.jpg',1674,2000,32,true),
  ('10000000-0000-4000-8000-000000000034','stone-hills-1854',null,null,'Stone Hills',null,null,'art/stone-hills-1854.jpg',2000,1613,33,true),
  ('10000000-0000-4000-8000-000000000035','stone-hills-1855',null,null,'Stone Hills',null,null,'art/stone-hills-1855.jpg',1559,2000,34,true),
  ('10000000-0000-4000-8000-000000000036','stone-hills-1894',null,null,'Stone Hills',null,null,'art/stone-hills-1894.jpg',1588,2000,35,true),
  ('10000000-0000-4000-8000-000000000037','stone-hills-1895',null,null,'Stone Hills',null,null,'art/stone-hills-1895.jpg',1619,2000,36,true),
  ('10000000-0000-4000-8000-000000000038','stone-hills-1896',null,null,'Stone Hills',null,null,'art/stone-hills-1896.jpg',2000,1585,37,true),
  ('10000000-0000-4000-8000-000000000039','stone-hills-1897',null,null,'Stone Hills',null,null,'art/stone-hills-1897.jpg',1593,2000,38,true),
  ('10000000-0000-4000-8000-000000000040','stone-hills-1898',null,null,'Stone Hills',null,null,'art/stone-hills-1898.jpg',1604,2000,39,true),
  ('10000000-0000-4000-8000-000000000041','stone-hills-1900',null,null,'Stone Hills',null,null,'art/stone-hills-1900.jpg',2000,1588,40,true)
on conflict (slug) do nothing;

insert into public.media_items
  (id, slug, kind, group_name, title, alt_text, external_url, legacy_path,
   mime_type, aspect_width, aspect_height, sort_order, published)
values
  ('20000000-0000-4000-8000-000000000001','portrait','portrait',null,'Portrait','Portrait of Nazlı Belgin',null,'art/portrait/nazlı.jpg','image/jpeg',1929,2411,0,true),
  ('20000000-0000-4000-8000-000000000002','canvas-dream-8','canvas_video',null,'Dream 8','Dream 8',null,'art/films/Dream 8.mp4','video/mp4',null,null,0,true),
  ('20000000-0000-4000-8000-000000000003','canvas-single-2','canvas_video',null,'Single 2 canvas','Single 2 canvas',null,'art/films/Single 2 canvas.mp4','video/mp4',null,null,1,true),
  ('20000000-0000-4000-8000-000000000004','canvas-single-5','canvas_video',null,'Single 5 canvas','Single 5 canvas',null,'art/films/Single 5 canvas.mp4','video/mp4',null,null,2,true),
  ('20000000-0000-4000-8000-000000000005','youtube-feature','youtube',null,'YouTube',null,'https://www.youtube-nocookie.com/embed/VriyhA6ayys',null,null,null,null,0,true),
  ('20000000-0000-4000-8000-000000000006','irmak-1','spotify_image','Irmak Akıncı','Irmak Akıncı 1','Spotify artwork for Irmak Akıncı, 1',null,'art/ırmak/image00002.png','image/png',null,null,0,true),
  ('20000000-0000-4000-8000-000000000007','irmak-2','spotify_image','Irmak Akıncı','Irmak Akıncı 2','Spotify artwork for Irmak Akıncı, 2',null,'art/ırmak/image00003.PNG','image/png',null,null,1,true),
  ('20000000-0000-4000-8000-000000000008','irmak-3','spotify_image','Irmak Akıncı','Irmak Akıncı 3','Spotify artwork for Irmak Akıncı, 3',null,'art/ırmak/image00005.PNG','image/png',null,null,2,true),
  ('20000000-0000-4000-8000-000000000009','irmak-4','spotify_image','Irmak Akıncı','Irmak Akıncı 4','Spotify artwork for Irmak Akıncı, 4',null,'art/ırmak/image00006.PNG','image/png',null,null,3,true),
  ('20000000-0000-4000-8000-000000000010','irmak-5','spotify_image','Irmak Akıncı','Irmak Akıncı 5','Spotify artwork for Irmak Akıncı, 5',null,'art/ırmak/image00007.PNG','image/png',null,null,4,true),
  ('20000000-0000-4000-8000-000000000011','irmak-6','spotify_image','Irmak Akıncı','Irmak Akıncı 6','Spotify artwork for Irmak Akıncı, 6',null,'art/ırmak/image00009.PNG','image/png',null,null,5,true),
  ('20000000-0000-4000-8000-000000000012','irmak-7','spotify_image','Irmak Akıncı','Irmak Akıncı 7','Spotify artwork for Irmak Akıncı, 7',null,'art/ırmak/image00011.PNG','image/png',null,null,6,true),
  ('20000000-0000-4000-8000-000000000013','irmak-8','spotify_image','Irmak Akıncı','Irmak Akıncı 8','Spotify artwork for Irmak Akıncı, 8',null,'art/ırmak/image00012.PNG','image/png',null,null,7,true),
  ('20000000-0000-4000-8000-000000000014','irmak-9','spotify_image','Irmak Akıncı','Irmak Akıncı 9','Spotify artwork for Irmak Akıncı, 9',null,'art/ırmak/image00013.PNG','image/png',null,null,8,true),
  ('20000000-0000-4000-8000-000000000015','irmak-10','spotify_image','Irmak Akıncı','Irmak Akıncı 10','Spotify artwork for Irmak Akıncı, 10',null,'art/ırmak/image00014.PNG','image/png',null,null,9,true),
  ('20000000-0000-4000-8000-000000000016','irmak-11','spotify_image','Irmak Akıncı','Irmak Akıncı 11','Spotify artwork for Irmak Akıncı, 11',null,'art/ırmak/image00015.PNG','image/png',null,null,10,true),
  ('20000000-0000-4000-8000-000000000017','feridun-1','spotify_image','Feridun Hürel','Feridun Hürel 1','Spotify artwork for Feridun Hürel, 1',null,'art/feridun/image00001.png','image/png',null,null,0,true),
  ('20000000-0000-4000-8000-000000000018','feridun-2','spotify_image','Feridun Hürel','Feridun Hürel 2','Spotify artwork for Feridun Hürel, 2',null,'art/feridun/image00010.png','image/png',null,null,1,true),
  ('20000000-0000-4000-8000-000000000019','humeyra-1','spotify_image','Hümeyra','Hümeyra 1','Spotify artwork for Hümeyra, 1',null,'art/hümeyra/image00004.png','image/png',null,null,0,true),
  ('20000000-0000-4000-8000-000000000020','humeyra-2','spotify_image','Hümeyra','Hümeyra 2','Spotify artwork for Hümeyra, 2',null,'art/hümeyra/image00008.png','image/png',null,null,1,true)
on conflict (slug) do nothing;

insert into public.cv_entries
  (id, slug, category, year, description, sort_order, published)
values
  ('30000000-0000-4000-8000-000000000001','exhibition-stone-hills-zero','exhibition','2025','Stone Hills Zero — Espacio Gallery, London (solo)',0,true),
  ('30000000-0000-4000-8000-000000000002','exhibition-gozlerimi-kapadim','exhibition','2025','Gözlerimi Kapadım — H Art Project Galeri (group exhibition)',1,true),
  ('30000000-0000-4000-8000-000000000003','exhibition-art-factor','exhibition','2025','International Art & Design Group Exhibition — Art Factor Gallery',2,true),
  ('30000000-0000-4000-8000-000000000004','exhibition-eve-donus','exhibition','2024','Eve Dönüş — H Art Project Galeri (group exhibition)',3,true),
  ('30000000-0000-4000-8000-000000000005','exhibition-kutnularda','exhibition','2019','Kutnularda Gaziantep — Gaziantep (group exhibition)',4,true),
  ('30000000-0000-4000-8000-000000000006','exhibition-drama-congress','exhibition','2019','30. Uluslararası Yaratıcı Drama Kongresi (group exhibition)',5,true),
  ('30000000-0000-4000-8000-000000000007','project-humeyra','project','2025','Hümeyra — Spotify Canvas illustrations',0,true),
  ('30000000-0000-4000-8000-000000000008','project-feridun-hurel','project','2025','Feridun Hürel — Spotify Canvas illustrations',1,true),
  ('30000000-0000-4000-8000-000000000009','project-irmak-akinci','project','2024','Pianist Irmak Akıncı — album cover and Spotify Canvas illustrations',2,true),
  ('30000000-0000-4000-8000-000000000010','project-giarose','project','2022','Gıarose Dergisi — art column writing',3,true),
  ('30000000-0000-4000-8000-000000000011','project-nature-art','project','2019','Nature Art Çalıştayı — Gaziantep',4,true),
  ('30000000-0000-4000-8000-000000000012','fair-art-nouva-ankara','fair','2025','Art Nouva Sanat Fuarı — 7 Art Galeri, Ankara',0,true),
  ('30000000-0000-4000-8000-000000000013','fair-art-concept-adana','fair','2025','Art Concept Sanat Fuarı — Historia Art Studio, Adana',1,true),
  ('30000000-0000-4000-8000-000000000014','fair-iaaf-izmir','fair','2025','IAAF — 3K Galeri, İzmir',2,true),
  ('30000000-0000-4000-8000-000000000015','fair-art-concept-antalya','fair','2025','Art Concept Sanat Fuarı — Historia Art Studio, Antalya',3,true)
on conflict (slug) do nothing;

commit;
