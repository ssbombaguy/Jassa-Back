import 'dotenv/config';
import { getClient } from './db.js';

async function seed() {
  const client = await getClient();
  try {
    console.log('Starting database setup...\n');
    await client.query('BEGIN');

    console.log('Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS nav_items CASCADE;
      DROP TABLE IF EXISTS product_sizes CASCADE;
      DROP TABLE IF EXISTS boot_details CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS subcategories CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS brands CASCADE;
      DROP TABLE IF EXISTS jerseys CASCADE;
      DROP TABLE IF EXISTS clubs CASCADE;
      DROP TABLE IF EXISTS leagues CASCADE;
    `);

    console.log('Creating tables...');
    await client.query(`
      CREATE TABLE leagues (
        league_id SERIAL PRIMARY KEY, league_name VARCHAR(100) NOT NULL UNIQUE,
        short_code VARCHAR(10) NOT NULL, country VARCHAR(60) NOT NULL,
        confederation VARCHAR(20) CHECK (confederation IN ('UEFA','CONMEBOL','CONCACAF','CAF','AFC','OFC')),
        tier SMALLINT DEFAULT 1, logo_url TEXT, adidas_partner BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE clubs (
        club_id SERIAL PRIMARY KEY, league_id INT NOT NULL REFERENCES leagues(league_id) ON DELETE RESTRICT,
        club_name VARCHAR(100) NOT NULL, short_name VARCHAR(10), founded_year SMALLINT,
        city VARCHAR(60), country VARCHAR(60), primary_color CHAR(7), secondary_color CHAR(7),
        crest_url TEXT, adidas_partner BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_clubs_league_id ON clubs(league_id);
      CREATE TABLE jerseys (
        jersey_id SERIAL PRIMARY KEY, club_id INT NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
        league_id INT NOT NULL REFERENCES leagues(league_id) ON DELETE RESTRICT,
        product_code VARCHAR(20) NOT NULL UNIQUE, season VARCHAR(9) NOT NULL,
        jersey_type VARCHAR(20) NOT NULL CHECK (jersey_type IN ('home','away','third','goalkeeper')),
        name VARCHAR(150) NOT NULL, description TEXT, price_usd DECIMAL(8,2) CHECK (price_usd > 0),
        discount_pct SMALLINT DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
        is_discounted BOOLEAN DEFAULT false, is_new_arrival BOOLEAN DEFAULT false,
        is_featured BOOLEAN DEFAULT false, is_ucl BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true, in_stock BOOLEAN DEFAULT true,
        technology VARCHAR(50), image_url TEXT, image_url_2 TEXT, image_url_3 TEXT,
        release_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_jerseys_club_id ON jerseys(club_id);
      CREATE INDEX idx_jerseys_league_id ON jerseys(league_id);
      CREATE INDEX idx_jerseys_season ON jerseys(season);
      CREATE TABLE brands (
        brand_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE, logo_url TEXT, brand_color CHAR(7),
        website_url VARCHAR(200), is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE categories (
        category_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE, description TEXT, is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE subcategories (
        subcategory_id SERIAL PRIMARY KEY, category_id INT NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL, slug VARCHAR(100) NOT NULL UNIQUE, description TEXT,
        is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_subcategories_category_id ON subcategories(category_id);
      CREATE TABLE products (
        product_id SERIAL PRIMARY KEY, category_id INT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
        subcategory_id INT NOT NULL REFERENCES subcategories(subcategory_id) ON DELETE RESTRICT,
        brand_id INT NOT NULL REFERENCES brands(brand_id) ON DELETE RESTRICT,
        name VARCHAR(200) NOT NULL, slug VARCHAR(200) NOT NULL UNIQUE, description TEXT,
        product_code VARCHAR(30) NOT NULL UNIQUE, price DECIMAL(8,2) NOT NULL CHECK (price > 0),
        discount_pct SMALLINT DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
        is_discounted BOOLEAN DEFAULT false, is_new_arrival BOOLEAN DEFAULT false,
        is_featured BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true, in_stock BOOLEAN DEFAULT true,
        image_url TEXT, image_url_2 TEXT, image_url_3 TEXT, release_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_products_category_id ON products(category_id);
      CREATE INDEX idx_products_subcategory_id ON products(subcategory_id);
      CREATE INDEX idx_products_brand_id ON products(brand_id);
      CREATE TABLE boot_details (
        boot_detail_id SERIAL PRIMARY KEY, product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE UNIQUE,
        boot_type VARCHAR(30) NOT NULL CHECK (boot_type IN ('firm_ground','soft_ground','astro_turf','indoor','multi_ground')),
        upper_material VARCHAR(50), stud_type VARCHAR(30), colorway VARCHAR(100),
        is_laceless BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE product_sizes (
        size_id SERIAL PRIMARY KEY, product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
        size VARCHAR(10) NOT NULL, stock_qty INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
        created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (product_id, size)
      );
      CREATE INDEX idx_product_sizes_product_id ON product_sizes(product_id);
      CREATE TABLE nav_items (
        nav_id       SERIAL PRIMARY KEY,
        label        VARCHAR(100) NOT NULL,
        path         VARCHAR(200),
        parent_id    INT REFERENCES nav_items(nav_id) ON DELETE CASCADE,
        position     SMALLINT NOT NULL DEFAULT 0,
        badge        VARCHAR(20),
        badge_color  CHAR(7),
        icon         VARCHAR(10),
        target       VARCHAR(10) DEFAULT '_self',
        section      VARCHAR(20) NOT NULL CHECK (section IN ('header','footer')),
        footer_group VARCHAR(50),
        is_active    BOOLEAN DEFAULT true,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_nav_items_parent_id ON nav_items(parent_id);
      CREATE INDEX idx_nav_items_section   ON nav_items(section);
    `);
    console.log('✅ All tables created\n');

    // ── helpers ──────────────────────────────────────────────────────────────
    const img      = (hex, label) => `https://placehold.co/400x500/${hex.replace('#','')}/FFFFFF?text=${encodeURIComponent(label)}`;
    const slugify  = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const rnd      = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
    const randDate = () => new Date(
        new Date('2024-06-01').getTime() +
        Math.random()*(new Date('2024-09-01').getTime()-new Date('2024-06-01').getTime())
    ).toISOString().split('T')[0];

    // ── LEAGUES ───────────────────────────────────────────────────────────────
    console.log('Inserting leagues...');
    const leaguesData = [
      {name:'Premier League',        code:'EPL', country:'England',     conf:'UEFA',     tier:1, partner:true, color:'#3D195B'},
      {name:'Bundesliga',            code:'BUN', country:'Germany',     conf:'UEFA',     tier:1, partner:true, color:'#D4001A'},
      {name:'Serie A',               code:'SA',  country:'Italy',       conf:'UEFA',     tier:1, partner:true, color:'#00529B'},
      {name:'MLS',                   code:'MLS', country:'USA',         conf:'CONCACAF', tier:1, partner:true, color:'#002B5C'},
      {name:'UEFA Champions League', code:'UCL', country:'Europe',      conf:'UEFA',     tier:0, partner:true, color:'#001D6C'},
      {name:'La Liga',               code:'LAL', country:'Spain',       conf:'UEFA',     tier:1, partner:true, color:'#FF4B00'},
      {name:'Ligue 1',               code:'L1',  country:'France',      conf:'UEFA',     tier:1, partner:true, color:'#003B8E'},
      {name:'Eredivisie',            code:'ERE', country:'Netherlands', conf:'UEFA',     tier:1, partner:true, color:'#D4001A'},
    ];
    const leagueInserts = [];
    for (const l of leaguesData) {
      const r = await client.query(
          `INSERT INTO leagues (league_name,short_code,country,confederation,tier,logo_url,adidas_partner)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING league_id`,
          [l.name,l.code,l.country,l.conf,l.tier,img(l.color,l.code),l.partner]
      );
      leagueInserts.push({...l, id:r.rows[0].league_id});
      console.log(`  ✓ ${l.name}`);
    }

    // ── CLUBS ─────────────────────────────────────────────────────────────────
    console.log('\nInserting clubs...');
    const clubsData = [
      {li:1,name:'Arsenal',             short:'ARS',f:1886,city:'London',      co:'England',     p:'#EF0107',s:'#FFFFFF'},
      {li:1,name:'Manchester United',   short:'MNU',f:1878,city:'Manchester',  co:'England',     p:'#DA291C',s:'#FFFFFF'},
      {li:1,name:'Chelsea',             short:'CHE',f:1905,city:'London',      co:'England',     p:'#034694',s:'#FFFFFF'},
      {li:1,name:'Leicester City',      short:'LEI',f:1884,city:'Leicester',   co:'England',     p:'#003DA5',s:'#FFFFFF'},
      {li:2,name:'FC Bayern München',   short:'BAY',f:1900,city:'Munich',      co:'Germany',     p:'#DC143C',s:'#FFFFFF'},
      {li:2,name:'Borussia Dortmund',   short:'DOR',f:1909,city:'Dortmund',    co:'Germany',     p:'#FFD700',s:'#000000'},
      {li:2,name:'RB Leipzig',          short:'RBL',f:2009,city:'Leipzig',     co:'Germany',     p:'#003D7A',s:'#FFFFFF'},
      {li:3,name:'Juventus',            short:'JUV',f:1897,city:'Turin',       co:'Italy',       p:'#000000',s:'#FFFFFF'},
      {li:3,name:'AC Milan',            short:'ACM',f:1899,city:'Milan',       co:'Italy',       p:'#C60C30',s:'#000000'},
      {li:3,name:'AS Roma',             short:'ROM',f:1927,city:'Rome',        co:'Italy',       p:'#CE1126',s:'#FFD700'},
      {li:4,name:'LA Galaxy',           short:'LAG',f:1994,city:'Los Angeles', co:'USA',         p:'#003D7A',s:'#FDB913'},
      {li:4,name:'Inter Miami CF',      short:'MIA',f:2020,city:'Miami',       co:'USA',         p:'#F7B5CD',s:'#000000'},
      {li:4,name:'Seattle Sounders',    short:'SEA',f:2007,city:'Seattle',     co:'USA',         p:'#5D9732',s:'#0C2C56'},
      {li:5,name:'Real Madrid',         short:'RM', f:1902,city:'Madrid',      co:'Spain',       p:'#FFFFFF',s:'#000000'},
      {li:6,name:'FC Barcelona',        short:'BAR',f:1899,city:'Barcelona',   co:'Spain',       p:'#A50044',s:'#004D98'},
      {li:6,name:'Atlético Madrid',     short:'ATM',f:1903,city:'Madrid',      co:'Spain',       p:'#CB3524',s:'#FFFFFF'},
      {li:6,name:'Sevilla FC',          short:'SEV',f:1890,city:'Seville',     co:'Spain',       p:'#D4002B',s:'#FFFFFF'},
      {li:6,name:'Real Betis',          short:'BET',f:1907,city:'Seville',     co:'Spain',       p:'#006B3F',s:'#FFFFFF'},
      {li:7,name:'Paris Saint-Germain', short:'PSG',f:1970,city:'Paris',       co:'France',      p:'#004170',s:'#DA291C'},
      {li:7,name:'Olympique Marseille', short:'OM', f:1899,city:'Marseille',   co:'France',      p:'#0C2340',s:'#FFFFFF'},
      {li:7,name:'AS Monaco',           short:'MON',f:1924,city:'Monaco',      co:'Monaco',      p:'#CC0000',s:'#FFFFFF'},
      {li:8,name:'Ajax Amsterdam',      short:'AJA',f:1900,city:'Amsterdam',   co:'Netherlands', p:'#D31145',s:'#FFFFFF'},
      {li:8,name:'Feyenoord',           short:'FEY',f:1908,city:'Rotterdam',   co:'Netherlands', p:'#E4002B',s:'#FFFFFF'},
      {li:8,name:'PSV Eindhoven',       short:'PSV',f:1913,city:'Eindhoven',   co:'Netherlands', p:'#E30613',s:'#FFFFFF'},
    ];
    const clubInserts = [];
    for (const c of clubsData) {
      const r = await client.query(
          `INSERT INTO clubs (league_id,club_name,short_name,founded_year,city,country,primary_color,secondary_color,crest_url,adidas_partner)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING club_id`,
          [c.li,c.name,c.short,c.f,c.city,c.co,c.p,c.s,img(c.p,c.short),true]
      );
      clubInserts.push({...c, id:r.rows[0].club_id});
      console.log(`  ✓ ${c.name}`);
    }

    // ── JERSEYS ───────────────────────────────────────────────────────────────
    console.log('\nInserting jerseys...');
    const uclClubs      = new Set(['Arsenal','FC Bayern München','Borussia Dortmund','Juventus','AC Milan','Real Madrid','FC Barcelona','Paris Saint-Germain']);
    const featuredClubs = new Set(['Arsenal','FC Bayern München','Juventus','Real Madrid','FC Barcelona','Inter Miami CF','Borussia Dortmund','AC Milan']);
    const newArrClubs   = new Set(['Arsenal','Manchester United','Chelsea','FC Bayern München','Borussia Dortmund','Juventus','LA Galaxy','Inter Miami CF','Real Madrid','FC Barcelona']);
    const discountMap   = {
      'Manchester United':{pct:15,types:['away']}, 'Chelsea':{pct:20,types:['third']},
      'Leicester City':{pct:10,types:['away']},    'FC Bayern München':{pct:25,types:['third']},
      'Borussia Dortmund':{pct:10,types:['away']}, 'RB Leipzig':{pct:15,types:['away']},
      'Juventus':{pct:20,types:['third']},         'AC Milan':{pct:10,types:['away']},
      'AS Roma':{pct:15,types:['third']},          'LA Galaxy':{pct:10,types:['third']},
      'Inter Miami CF':{pct:20,types:['third']},   'Sevilla FC':{pct:15,types:['away']},
      'Olympique Marseille':{pct:10,types:['third']},
    };
    const jDesc = {
      home: 'The iconic home kit worn at the fortress. Built for performance with club pride.',
      away: 'Take the fight on the road. Lightweight away kit for tough away matches.',
      third:'The bold third kit. A statement piece for cup nights and special occasions.',
    };
    const clubLeagueMap = [
      [1,1],[2,1],[3,1],[4,1],[5,2],[6,2],[7,2],[8,3],[9,3],[10,3],
      [11,4],[12,4],[13,4],[14,5],[15,6],[16,6],[17,6],[18,6],
      [19,7],[20,7],[21,7],[22,8],[23,8],[24,8],
    ];
    const techs  = ['HEAT.RDY','AEROREADY'];
    const jTypes = ['home','away','third'];
    let jCount = 0;
    for (const [ci,[clubId,leagueId]] of clubLeagueMap.entries()) {
      const club = clubInserts[ci];
      const disc = discountMap[club.name];
      for (let i=0;i<3;i++) {
        const jt   = jTypes[i];
        const isD  = !!disc?.types?.includes(jt);
        const dPct = isD ? disc.pct : 0;
        const isN  = newArrClubs.has(club.name) && jt==='home';
        const isF  = featuredClubs.has(club.name) && jt==='home';
        const isU  = uclClubs.has(club.name);
        const price= (jt==='third'?100:110)+rnd(0,20);
        const letters = club.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
        const code = letters+String(6000+jCount).padStart(4,'0');
        const name = `${club.name} ${jt.charAt(0).toUpperCase()+jt.slice(1)} Jersey 2024/25`;
        await client.query(
            `INSERT INTO jerseys
           (club_id,league_id,product_code,season,jersey_type,name,description,
            price_usd,discount_pct,is_discounted,is_new_arrival,is_featured,is_ucl,
            technology,in_stock,release_date,image_url,image_url_2,image_url_3)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
            [clubId,leagueId,code,'2024/25',jt,name,jDesc[jt],price,dPct,isD,isN,isF,isU,
              techs[i%2],true,randDate(),
              img(club.p,`${club.short} ${jt}`),
              img(club.s==='#FFFFFF'?club.p:club.s,`${club.short} ${jt} 2`),
              img(club.p,`${club.short} ${jt} 3`)]
        );
        console.log(`  ✓ ${name} $${price}${isD?` -${dPct}%`:''}${isN?' 🆕':''}${isF?' ⭐':''}`);
        jCount++;
      }
    }

    // ── BRANDS ────────────────────────────────────────────────────────────────
    console.log('\nInserting brands...');
    const brandsData = [
      {name:'Adidas',      slug:'adidas',      color:'#000000', web:'https://adidas.com'},
      {name:'Nike',        slug:'nike',        color:'#111111', web:'https://nike.com'},
      {name:'Puma',        slug:'puma',        color:'#E4002B', web:'https://puma.com'},
      {name:'New Balance', slug:'new-balance', color:'#CF0A2C', web:'https://newbalance.com'},
      {name:'Mitre',       slug:'mitre',       color:'#D4001A', web:'https://mitre.com'},
    ];
    const brandInserts = [];
    for (const b of brandsData) {
      const r = await client.query(
          `INSERT INTO brands (name,slug,logo_url,brand_color,website_url) VALUES ($1,$2,$3,$4,$5) RETURNING brand_id`,
          [b.name,b.slug,img(b.color,b.name),b.color,b.web]
      );
      brandInserts.push({...b, id:r.rows[0].brand_id});
      console.log(`  ✓ ${b.name}`);
    }
    const bId = (name) => brandInserts.find(b=>b.name===name);

    // ── CATEGORIES ────────────────────────────────────────────────────────────
    console.log('\nInserting categories...');
    const catsData = [
      {name:'Boot',      slug:'boot',      desc:'Football boots for every surface'},
      {name:'Equipment', slug:'equipment', desc:'Balls, shin guards, gloves and more'},
      {name:'Training',  slug:'training',  desc:'Cones, ladders, hurdles and training aids'},
      {name:'Accessory', slug:'accessory', desc:'Socks, shorts, bags and accessories'},
    ];
    const catInserts = [];
    for (const c of catsData) {
      const r = await client.query(
          `INSERT INTO categories (name,slug,description) VALUES ($1,$2,$3) RETURNING category_id`,
          [c.name,c.slug,c.desc]
      );
      catInserts.push({...c, id:r.rows[0].category_id});
      console.log(`  ✓ ${c.name}`);
    }
    const cId = (slug) => catInserts.find(c=>c.slug===slug).id;

    // ── SUBCATEGORIES ─────────────────────────────────────────────────────────
    console.log('\nInserting subcategories...');
    const subsData = [
      {cs:'boot',      name:'Firm Ground',    slug:'firm-ground'},
      {cs:'boot',      name:'Soft Ground',    slug:'soft-ground'},
      {cs:'boot',      name:'Astro Turf',     slug:'astro-turf'},
      {cs:'boot',      name:'Indoor',         slug:'indoor'},
      {cs:'boot',      name:'Multi Ground',   slug:'multi-ground'},
      {cs:'equipment', name:'Football',       slug:'football'},
      {cs:'equipment', name:'Shin Guard',     slug:'shin-guard'},
      {cs:'equipment', name:'GK Glove',       slug:'gk-glove'},
      {cs:'equipment', name:'Training Bib',   slug:'training-bib'},
      {cs:'equipment', name:'Training Bag',   slug:'training-bag'},
      {cs:'training',  name:'Training Cone',  slug:'training-cone'},
      {cs:'training',  name:'Agility Ladder', slug:'agility-ladder'},
      {cs:'training',  name:'Speed Hurdle',   slug:'speed-hurdle'},
      {cs:'training',  name:'Rebounder',      slug:'rebounder'},
      {cs:'training',  name:'Mannequin',      slug:'mannequin'},
      {cs:'accessory', name:'Socks',          slug:'socks'},
      {cs:'accessory', name:'Shorts',         slug:'shorts'},
      {cs:'accessory', name:'Cap',            slug:'cap'},
      {cs:'accessory', name:'Water Bottle',   slug:'water-bottle'},
    ];
    const subInserts = [];
    for (const s of subsData) {
      const r = await client.query(
          `INSERT INTO subcategories (category_id,name,slug) VALUES ($1,$2,$3) RETURNING subcategory_id`,
          [cId(s.cs),s.name,s.slug]
      );
      subInserts.push({...s, id:r.rows[0].subcategory_id});
      console.log(`  ✓ ${s.cs} → ${s.name}`);
    }
    const sId = (slug) => subInserts.find(s=>s.slug===slug).id;

    // ── PRODUCTS ──────────────────────────────────────────────────────────────
    console.log('\nInserting products...');
    const bSizes   = ['6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11','12'];
    const cSizes   = ['XS','S','M','L','XL','XXL'];
    const sSizes   = ['XS','S','M','L','XL'];
    const gSizes   = ['7','8','9','10','11'];
    const socSizes = ['S','M','L','XL'];

    const prods = [
      // BOOTS
      {cs:'boot',ss:'firm-ground', br:'Adidas',      name:'Adidas Predator 24 Elite FG',        code:'AD-PRE24-EL-FG',  price:280,dPct:0, isD:false,isN:true, isF:true, desc:'The ultimate control boot. DEMONSKIN technology.',                bt:'firm_ground',up:'synthetic',st:'bladed', cw:'Black/White/Solar Red',       lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Adidas',      name:'Adidas Predator 24 League FG',       code:'AD-PRE24-LG-FG',  price:100,dPct:20,isD:true, isN:false,isF:false,desc:'Entry level Predator. Great value firm ground boot.',          bt:'firm_ground',up:'synthetic',st:'conical',cw:'Black/White',                   lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Adidas',      name:'Adidas X Crazyfast.1 FG',            code:'AD-XCF1-FG',      price:260,dPct:0, isD:false,isN:false,isF:true, desc:'The lightest boot in the game. Built for speed demons.',       bt:'firm_ground',up:'knit',      st:'bladed', cw:'Solar Yellow/Black',          lac:true, sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Adidas',      name:'Adidas Copa Pure 2 Elite FG',        code:'AD-COP2-EL-FG',   price:280,dPct:0, isD:false,isN:true, isF:false,desc:'Pure K-leather touch. The Copa legacy continues.',            bt:'firm_ground',up:'leather',   st:'conical',cw:'Core Black/Cloud White',       lac:false,sz:bSizes},
      {cs:'boot',ss:'astro-turf',  br:'Adidas',      name:'Adidas Predator 24 Pro AG',          code:'AD-PRE24-AG',     price:150,dPct:0, isD:false,isN:false,isF:false,desc:'Predator control on artificial grass.',                       bt:'astro_turf', up:'synthetic',st:'mixed',  cw:'Black/White',                   lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Adidas',      name:'Adidas X Crazyfast Club FG',         code:'AD-XCF-CL-FG',    price:60, dPct:15,isD:true, isN:false,isF:false,desc:'Speed at every price point. Club level X Crazyfast.',         bt:'firm_ground',up:'synthetic',st:'conical',cw:'Solar Yellow/Black',          lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Nike',        name:'Nike Mercurial Superfly 9 Elite FG', code:'NK-MSF9-EL-FG',   price:275,dPct:0, isD:false,isN:false,isF:true, desc:'The fastest boot on the planet. Vaporposite+ upper.',         bt:'firm_ground',up:'synthetic',st:'bladed', cw:'Volt/Black/White',            lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Nike',        name:'Nike Phantom GX Elite FG',           code:'NK-PGX-EL-FG',    price:275,dPct:0, isD:false,isN:true, isF:false,desc:'Precision passing meets elite touch.',                        bt:'firm_ground',up:'knit',      st:'bladed', cw:'Total Orange/Black',          lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Nike',        name:'Nike Tiempo Legend 10 Elite FG',     code:'NK-TL10-EL-FG',   price:230,dPct:0, isD:false,isN:false,isF:false,desc:'Genuine kangaroo leather for natural touch.',                 bt:'firm_ground',up:'leather',   st:'conical',cw:'Black/Metallic Gold',          lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Nike',        name:'Nike Mercurial Vapor 15 Club FG',    code:'NK-MV15-CL-FG',   price:65, dPct:30,isD:true, isN:false,isF:false,desc:'Budget Mercurial speed. Great entry boot.',                   bt:'firm_ground',up:'synthetic',st:'conical',cw:'Volt/Black',                    lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Puma',        name:'Puma Future 7 Ultimate FG',          code:'PU-FUT7-UL-FG',   price:265,dPct:0, isD:false,isN:true, isF:false,desc:'Adaptive FUZIONFIT+ compression band.',                      bt:'firm_ground',up:'knit',      st:'bladed', cw:'Electric Peppermint/Black',   lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Puma',        name:'Puma King Ultimate FG',              code:'PU-KNG-UL-FG',    price:265,dPct:0, isD:false,isN:false,isF:true, desc:'The legendary King silhouette. Premium leather.',             bt:'firm_ground',up:'leather',   st:'conical',cw:'Black/White',                   lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'Puma',        name:'Puma Ultra Ultimate FG',             code:'PU-ULT-UL-FG',    price:265,dPct:0, isD:false,isN:false,isF:false,desc:'Ultra lightweight. MATRYXEVO upper for speed.',               bt:'firm_ground',up:'synthetic',st:'bladed', cw:'Yellow Alert/Black',          lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'New Balance', name:'New Balance Furon v7 Pro FG',        code:'NB-FUR7-PR-FG',   price:200,dPct:0, isD:false,isN:false,isF:false,desc:'Engineered for speed. Lightweight synthetic upper.',          bt:'firm_ground',up:'synthetic',st:'conical',cw:'Magnet/Neon Dragonfly',       lac:false,sz:bSizes},
      {cs:'boot',ss:'firm-ground', br:'New Balance', name:'New Balance Tekela v4 Magia FG',     code:'NB-TEK4-MG-FG',   price:210,dPct:0, isD:false,isN:true, isF:false,desc:'Supreme touch and fit for technical players.',               bt:'firm_ground',up:'knit',      st:'bladed', cw:'Brick/Black',                 lac:false,sz:bSizes},
      // EQUIPMENT
      {cs:'equipment',ss:'football',     br:'Adidas', name:'Adidas Champions League Ball 2024',  code:'AD-UCL-BALL-24',  price:165,dPct:0, isD:false,isN:false,isF:true, desc:'Official UCL match ball 2024/25.',                           sz:['One Size']},
      {cs:'equipment',ss:'football',     br:'Adidas', name:'Adidas Premier League Ball 2024',    code:'AD-EPL-BALL-24',  price:165,dPct:0, isD:false,isN:true, isF:true, desc:'Official EPL match ball. Flight technology.',                sz:['One Size']},
      {cs:'equipment',ss:'football',     br:'Nike',   name:'Nike Premier League Pitch Ball',     code:'NK-EPL-PITCH-24', price:50, dPct:20,isD:true, isN:false,isF:false,desc:'Durable training ball with PL graphics.',                    sz:['One Size']},
      {cs:'equipment',ss:'football',     br:'Puma',   name:'Puma Orbita La Liga Ball',           code:'PU-LAL-BALL-24',  price:160,dPct:0, isD:false,isN:false,isF:false,desc:'Official La Liga match ball.',                               sz:['One Size']},
      {cs:'equipment',ss:'shin-guard',   br:'Nike',   name:'Nike Mercurial Lite Shin Guards',    code:'NK-SG-MERC-LITE', price:25, dPct:0, isD:false,isN:true, isF:false,desc:'Ultra-lightweight shin guards. Anatomical fit.',            sz:sSizes},
      {cs:'equipment',ss:'shin-guard',   br:'Adidas', name:'Adidas Predator Match Shin Guards',  code:'AD-SG-PRED-MAT',  price:35, dPct:0, isD:false,isN:false,isF:false,desc:'Hard shell protection. Predator styling.',                   sz:sSizes},
      {cs:'equipment',ss:'shin-guard',   br:'Puma',   name:'Puma Ultra Light Shin Guards',       code:'PU-SG-ULTRA',     price:20, dPct:15,isD:true, isN:false,isF:false,desc:'Minimal weight, maximum comfort.',                          sz:sSizes},
      {cs:'equipment',ss:'gk-glove',     br:'Adidas', name:'Adidas Predator GL Pro',             code:'AD-GK-PRED-PRO',  price:90, dPct:0, isD:false,isN:false,isF:true, desc:'DEMONSKIN palm for incredible grip.',                       sz:gSizes},
      {cs:'equipment',ss:'gk-glove',     br:'Nike',   name:'Nike Goalkeeper Vapor Grip 3',       code:'NK-GK-VG3',       price:85, dPct:0, isD:false,isN:true, isF:false,desc:'Grip3 foam for reliable handling.',                         sz:gSizes},
      {cs:'equipment',ss:'gk-glove',     br:'Puma',   name:'Puma Future Ultimate NC',            code:'PU-GK-FUT-NC',    price:95, dPct:0, isD:false,isN:false,isF:false,desc:'NegativeCut for snug responsive fit.',                      sz:gSizes},
      {cs:'equipment',ss:'training-bib', br:'Adidas', name:'Adidas Team Training Bib',           code:'AD-BIB-TEAM',     price:15, dPct:0, isD:false,isN:false,isF:false,desc:'Mesh bib for squad sessions.',                              sz:['One Size']},
      {cs:'equipment',ss:'training-bib', br:'Nike',   name:'Nike Dri-FIT Academy Bib',           code:'NK-BIB-ACAD',     price:12, dPct:10,isD:true, isN:false,isF:false,desc:'Lightweight Dri-FIT mesh bib.',                             sz:['One Size']},
      // TRAINING
      {cs:'training',ss:'training-cone',  br:'Adidas', name:'Adidas Training Cone Set (20 pack)', code:'AD-CONE-20PK',   price:20, dPct:0, isD:false,isN:true, isF:false,desc:'20 high-visibility training cones.',                        sz:['One Size']},
      {cs:'training',ss:'training-cone',  br:'Nike',   name:'Nike Pro Training Cone Set',         code:'NK-CONE-PRO',    price:18, dPct:0, isD:false,isN:false,isF:false,desc:'Durable cones for marker drills.',                          sz:['One Size']},
      {cs:'training',ss:'training-cone',  br:'Puma',   name:'Puma Cone Set (10 pack)',            code:'PU-CONE-10PK',   price:12, dPct:10,isD:true, isN:false,isF:false,desc:'Compact 10-cone set.',                                      sz:['One Size']},
      {cs:'training',ss:'agility-ladder', br:'Adidas', name:'Adidas Speed Agility Ladder',        code:'AD-LAD-SPD',     price:35, dPct:0, isD:false,isN:false,isF:true, desc:'10-rung agility ladder with carry bag.',                    sz:['One Size']},
      {cs:'training',ss:'agility-ladder', br:'Nike',   name:'Nike Speed Rope Ladder',             code:'NK-LAD-ROPE',    price:30, dPct:0, isD:false,isN:true, isF:false,desc:'Adjustable flat rungs for fast footwork drills.',           sz:['One Size']},
      {cs:'training',ss:'agility-ladder', br:'Puma',   name:'Puma Agility Training Ladder',       code:'PU-LAD-AGIL',    price:25, dPct:0, isD:false,isN:false,isF:false,desc:'Lightweight agility ladder.',                              sz:['One Size']},
      {cs:'training',ss:'speed-hurdle',   br:'Adidas', name:'Adidas Speed Hurdle Set (5 pack)',   code:'AD-HRD-5PK',     price:45, dPct:0, isD:false,isN:false,isF:true, desc:'Adjustable height hurdles for speed training.',             sz:['One Size']},
      {cs:'training',ss:'speed-hurdle',   br:'Nike',   name:'Nike Pro Speed Hurdles',             code:'NK-HRD-PRO',     price:40, dPct:0, isD:false,isN:false,isF:false,desc:'Professional speed hurdles.',                              sz:['One Size']},
      {cs:'training',ss:'rebounder',      br:'Adidas', name:'Adidas Rebounder Training Net',      code:'AD-REB-NET',     price:120,dPct:0, isD:false,isN:false,isF:true, desc:'Adjustable rebounder for solo passing practice.',           sz:['One Size']},
      {cs:'training',ss:'rebounder',      br:'Puma',   name:'Puma Skill Rebounder',               code:'PU-REB-SKILL',   price:85, dPct:0, isD:false,isN:true, isF:false,desc:'Compact rebounder for skill development.',                 sz:['One Size']},
      {cs:'training',ss:'mannequin',      br:'Adidas', name:'Adidas Training Mannequin',          code:'AD-MAN-TRN',     price:80, dPct:0, isD:false,isN:false,isF:false,desc:'Free kick and dribbling practice mannequin.',               sz:['One Size']},
      {cs:'training',ss:'mannequin',      br:'Mitre',  name:'Pro Training Mannequin (5 pack)',    code:'MI-MAN-5PK',     price:350,dPct:0, isD:false,isN:false,isF:true, desc:'Set of 5 professional training mannequins.',               sz:['One Size']},
      // ACCESSORIES
      {cs:'accessory',ss:'socks',  br:'Adidas', name:'Adidas Milano Socks',          code:'AD-SOC-MIL',     price:15, dPct:0, isD:false,isN:true, isF:false,desc:'Classic football socks with cushioned sole.',              sz:socSizes},
      {cs:'accessory',ss:'socks',  br:'Nike',   name:'Nike Grip Strike Socks',       code:'NK-SOC-GRIP',    price:18, dPct:0, isD:false,isN:false,isF:false,desc:'Grip technology to lock your foot in the boot.',           sz:socSizes},
      {cs:'accessory',ss:'socks',  br:'Puma',   name:'Puma Football Socks',          code:'PU-SOC-FOOT',    price:12, dPct:20,isD:true, isN:false,isF:false,desc:'Lightweight football socks.',                              sz:socSizes},
      {cs:'accessory',ss:'shorts', br:'Adidas', name:'Adidas Tiro 24 Shorts',        code:'AD-SHO-TIRO24',  price:30, dPct:0, isD:false,isN:true, isF:false,desc:'AEROREADY training shorts.',                               sz:cSizes},
      {cs:'accessory',ss:'shorts', br:'Nike',   name:'Nike Dri-FIT Strike Shorts',   code:'NK-SHO-STRIKE',  price:35, dPct:0, isD:false,isN:false,isF:true, desc:'Dri-FIT technology keeps you dry.',                        sz:cSizes},
      {cs:'accessory',ss:'shorts', br:'Puma',   name:'Puma TeamGOAL Shorts',         code:'PU-SHO-TGOAL',   price:28, dPct:0, isD:false,isN:false,isF:false,desc:'Lightweight dryCELL shorts.',                              sz:cSizes},
      {cs:'accessory',ss:'cap',    br:'Adidas', name:'Adidas Tiro League Duffel Bag',code:'AD-BAG-TIRO-DUF', price:55,dPct:0, isD:false,isN:false,isF:true, desc:'Spacious duffel with separate boot compartment.',          sz:['One Size']},
      {cs:'accessory',ss:'cap',    br:'Nike',   name:'Nike Academy Team Backpack',   code:'NK-BAG-ACAD-BP', price:45, dPct:0, isD:false,isN:true, isF:false,desc:'Roomy backpack with ball net and laptop sleeve.',          sz:['One Size']},
    ];

    let pCount = 0;
    for (const p of prods) {
      const brand = bId(p.br);
      const r = await client.query(
          `INSERT INTO products
         (category_id,subcategory_id,brand_id,name,slug,description,product_code,
          price,discount_pct,is_discounted,is_new_arrival,is_featured,
          in_stock,image_url,image_url_2,image_url_3,release_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING product_id`,
          [cId(p.cs),sId(p.ss),brand.id,p.name,slugify(p.name),p.desc,p.code,
            p.price,p.dPct,p.isD,p.isN,p.isF,true,
            img(brand.color,p.name.substring(0,18)),
            img(brand.color,p.name.substring(0,14)+' 2'),
            img(brand.color,p.name.substring(0,14)+' 3'),
            randDate()]
      );
      const pid = r.rows[0].product_id; pCount++;
      console.log(`  ✓ ${p.name} $${p.price}${p.isD?` -${p.dPct}%`:''}${p.isN?' 🆕':''}${p.isF?' ⭐':''}`);
      if (p.bt) {
        await client.query(
            `INSERT INTO boot_details (product_id,boot_type,upper_material,stud_type,colorway,is_laceless)
           VALUES ($1,$2,$3,$4,$5,$6)`,
            [pid,p.bt,p.up,p.st,p.cw,p.lac]
        );
      }
      for (const sz of p.sz) {
        await client.query(
            `INSERT INTO product_sizes (product_id,size,stock_qty) VALUES ($1,$2,$3)`,
            [pid,sz,sz==='One Size'?rnd(10,100):rnd(0,30)]
        );
      }
    }

    // ── NAV ITEMS ─────────────────────────────────────────────────────────────
    console.log('\nInserting nav items...');

    // helper to insert and return nav_id
    const insertNav = async (label,path,parentId,position,section,footerGroup=null,badge=null,badgeColor=null,icon=null,target='_self') => {
      const r = await client.query(
          `INSERT INTO nav_items (label,path,parent_id,position,badge,badge_color,icon,target,section,footer_group)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING nav_id`,
          [label,path,parentId,position,badge,badgeColor,icon,target,section,footerGroup]
      );
      return r.rows[0].nav_id;
    };

    // ── HEADER NAV ────────────────────────────────────────────────────────────
    const navHome    = await insertNav('Home',        '/',            null, 1, 'header');
    const navJerseys = await insertNav('Jerseys',     '/jerseys',     null, 2, 'header');
    const navLeagues = await insertNav('Leagues',     '/leagues',     null, 3, 'header');
    const navEquip   = await insertNav('Equipment',   '/equipment',   null, 4, 'header');
    const navSale    = await insertNav('Sale',        '/sale',        null, 5, 'header', null, 'SALE', '#E4002B');
    const navNew     = await insertNav('New Arrivals','/new-arrivals',null, 6, 'header', null, 'NEW',  '#52b788');

    // Jerseys dropdown
    await insertNav('All Jerseys',   '/jerseys',              navJerseys, 1, 'header');
    await insertNav('Home Kits',     '/jerseys?type=home',    navJerseys, 2, 'header');
    await insertNav('Away Kits',     '/jerseys?type=away',    navJerseys, 3, 'header');
    await insertNav('Third Kits',    '/jerseys?type=third',   navJerseys, 4, 'header');
    await insertNav('Goalkeeper',    '/jerseys?type=goalkeeper',navJerseys,5,'header');

    // Leagues dropdown — use league IDs from database
    await insertNav('All Leagues',           '/leagues',    navLeagues, 1, 'header');
    await insertNav('Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿', '/leagues/1',  navLeagues, 2, 'header');
    await insertNav('Bundesliga 🇩🇪',         '/leagues/2',  navLeagues, 3, 'header');
    await insertNav('Serie A 🇮🇹',            '/leagues/3',  navLeagues, 4, 'header');
    await insertNav('MLS 🇺🇸',                '/leagues/4',  navLeagues, 5, 'header');
    await insertNav('UEFA Champions League ⭐','/leagues/5', navLeagues, 6, 'header');
    await insertNav('La Liga 🇪🇸',            '/leagues/6',  navLeagues, 7, 'header');
    await insertNav('Ligue 1 🇫🇷',            '/leagues/7',  navLeagues, 8, 'header');
    await insertNav('Eredivisie 🇳🇱',          '/leagues/8',  navLeagues, 9, 'header');

    // Equipment dropdown
    await insertNav('All Equipment',  '/equipment',               navEquip, 1, 'header');
    await insertNav('Boots',          '/boots',                   navEquip, 2, 'header');
    await insertNav('Footballs',      '/equipment/football',      navEquip, 3, 'header');
    await insertNav('Shin Guards',    '/equipment/shin-guard',    navEquip, 4, 'header');
    await insertNav('GK Gloves',      '/equipment/gk-glove',      navEquip, 5, 'header');
    await insertNav('Training Cones', '/training/training-cone',  navEquip, 6, 'header');
    await insertNav('Agility Ladders','/training/agility-ladder', navEquip, 7, 'header');
    await insertNav('Speed Hurdles',  '/training/speed-hurdle',   navEquip, 8, 'header');
    await insertNav('Rebounders',     '/training/rebounder',      navEquip, 9, 'header');
    await insertNav('Bibs',           '/equipment/training-bib',  navEquip, 10,'header');
    await insertNav('Accessories',    '/accessories',             navEquip, 11,'header');

    console.log('  ✓ Header nav items inserted');

    // ── FOOTER NAV ────────────────────────────────────────────────────────────

    // Shop column
    await insertNav('Home',          '/',               null, 1, 'footer', 'Shop');
    await insertNav('Jerseys',       '/jerseys',        null, 2, 'footer', 'Shop');
    await insertNav('Boots',         '/boots',          null, 3, 'footer', 'Shop');
    await insertNav('Equipment',     '/equipment',      null, 4, 'footer', 'Shop');
    await insertNav('New Arrivals',  '/new-arrivals',   null, 5, 'footer', 'Shop');
    await insertNav('Sale',          '/sale',           null, 6, 'footer', 'Shop');

    // Leagues column
    await insertNav('Premier League',        '/leagues/1', null, 1, 'footer', 'Leagues');
    await insertNav('Bundesliga',            '/leagues/2', null, 2, 'footer', 'Leagues');
    await insertNav('Serie A',               '/leagues/3', null, 3, 'footer', 'Leagues');
    await insertNav('La Liga',               '/leagues/6', null, 4, 'footer', 'Leagues');
    await insertNav('MLS',                   '/leagues/4', null, 5, 'footer', 'Leagues');
    await insertNav('UEFA Champions League', '/leagues/5', null, 6, 'footer', 'Leagues');

    // Help column
    await insertNav('Contact Us',  '/contact',    null, 1, 'footer', 'Help');
    await insertNav('FAQ',         '/faq',        null, 2, 'footer', 'Help');
    await insertNav('Shipping',    '/shipping',   null, 3, 'footer', 'Help');
    await insertNav('Returns',     '/returns',    null, 4, 'footer', 'Help');
    await insertNav('Size Guide',  '/size-guide', null, 5, 'footer', 'Help');
    await insertNav('Track Order', '/track',      null, 6, 'footer', 'Help');

    // Social column — external links
    await insertNav('Instagram', 'https://instagram.com/jasssport', null, 1, 'footer', 'Follow Us', null, null, '📸', '_blank');
    await insertNav('Twitter/X', 'https://x.com/jasssport',         null, 2, 'footer', 'Follow Us', null, null, '🐦', '_blank');
    await insertNav('Facebook',  'https://facebook.com/jasssport',  null, 3, 'footer', 'Follow Us', null, null, '👍', '_blank');
    await insertNav('YouTube',   'https://youtube.com/@jasssport',  null, 4, 'footer', 'Follow Us', null, null, '▶️', '_blank');
    await insertNav('TikTok',    'https://tiktok.com/@jasssport',   null, 5, 'footer', 'Follow Us', null, null, '🎵', '_blank');

    console.log('  ✓ Footer nav items inserted');

    await client.query('COMMIT');
    console.log('\n✅ Seeding complete!');
    console.log(`   Leagues:       ${leaguesData.length}`);
    console.log(`   Clubs:         ${clubsData.length}`);
    console.log(`   Jerseys:       ${jCount}`);
    console.log(`   Brands:        ${brandsData.length}`);
    console.log(`   Categories:    ${catsData.length}`);
    console.log(`   Subcategories: ${subsData.length}`);
    console.log(`   Products:      ${pCount}`);
    console.log(`   Nav items:     header + footer ✓`);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding database:', e);
    throw e;
  } finally {
    client.release();
  }
}

seed()
    .then(() => { console.log('\nDone. Run: npm start'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });