import 'dotenv/config';
import { getClient, query } from './db.js';

/**
 * Seed the database with initial data
 * Inserts leagues, clubs, and jerseys in the correct order respecting FK constraints
 */
async function seed() {
  const client = await getClient();

  try {
    console.log('Starting database setup...\n');

    // Begin transaction
    await client.query('BEGIN');

    // Drop tables in reverse FK order
    console.log('Dropping existing tables...');
    await client.query('DROP TABLE IF EXISTS jerseys CASCADE');
    await client.query('DROP TABLE IF EXISTS clubs CASCADE');
    await client.query('DROP TABLE IF EXISTS leagues CASCADE');

    // Create leagues table
    console.log('Creating leagues table...');
    await client.query(`
      CREATE TABLE leagues (
        league_id SERIAL PRIMARY KEY,
        league_name VARCHAR(100) NOT NULL UNIQUE,
        short_code VARCHAR(10) NOT NULL,
        country VARCHAR(60) NOT NULL,
        confederation VARCHAR(20) CHECK (confederation IN ('UEFA','CONMEBOL','CONCACAF','CAF','AFC','OFC')),
        tier SMALLINT DEFAULT 1,
        adidas_partner BOOLEAN DEFAULT false,
        contract_start DATE,
        contract_end DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create clubs table
    console.log('Creating clubs table...');
    await client.query(`
      CREATE TABLE clubs (
        club_id SERIAL PRIMARY KEY,
        league_id INT NOT NULL REFERENCES leagues(league_id) ON DELETE RESTRICT,
        club_name VARCHAR(100) NOT NULL,
        short_name VARCHAR(10),
        founded_year SMALLINT,
        city VARCHAR(60),
        country VARCHAR(60),
        primary_color CHAR(7),
        secondary_color CHAR(7),
        adidas_partner BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_clubs_league_id ON clubs(league_id);
    `);

    // Create jerseys table
    console.log('Creating jerseys table...');
    await client.query(`
      CREATE TABLE jerseys (
        jersey_id SERIAL PRIMARY KEY,
        club_id INT NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
        league_id INT NOT NULL REFERENCES leagues(league_id) ON DELETE RESTRICT,
        product_code VARCHAR(20) NOT NULL UNIQUE,
        season VARCHAR(9) NOT NULL,
        jersey_type VARCHAR(20) NOT NULL CHECK (jersey_type IN ('home','away','third','goalkeeper')),
        name VARCHAR(150) NOT NULL,
        price_usd DECIMAL(8,2) CHECK (price_usd > 0),
        technology VARCHAR(50),
        in_stock BOOLEAN DEFAULT true,
        release_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_jerseys_club_id ON jerseys(club_id);
      CREATE INDEX idx_jerseys_league_id ON jerseys(league_id);
      CREATE INDEX idx_jerseys_season ON jerseys(season);
    `);

    // Insert leagues
    console.log('\nInserting leagues...');
    const leagues = [
      {
        name: 'Premier League',
        code: 'EPL',
        country: 'England',
        confederation: 'UEFA',
        tier: 1,
        partner: true,
      },
      {
        name: 'Bundesliga',
        code: 'BUN',
        country: 'Germany',
        confederation: 'UEFA',
        tier: 1,
        partner: true,
      },
      {
        name: 'Serie A',
        code: 'SA',
        country: 'Italy',
        confederation: 'UEFA',
        tier: 1,
        partner: true,
      },
      {
        name: 'MLS',
        code: 'MLS',
        country: 'USA',
        confederation: 'CONCACAF',
        tier: 1,
        partner: true,
      },
      {
        name: 'UEFA Champions League',
        code: 'UCL',
        country: 'Europe',
        confederation: 'UEFA',
        tier: 0,
        partner: true,
      },
    ];

    const leagueInserts = [];
    for (const league of leagues) {
      const result = await client.query(
        `INSERT INTO leagues (league_name, short_code, country, confederation, tier, adidas_partner)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING league_id`,
        [league.name, league.code, league.country, league.confederation, league.tier, league.partner]
      );
      leagueInserts.push({ ...league, id: result.rows[0].league_id });
      console.log(`  ✓ ${league.name}`);
    }

    // Insert clubs
    console.log('\nInserting clubs...');
    const clubsData = [
      // Premier League clubs
      {
        leagueId: 1,
        name: 'Arsenal',
        short: 'ARS',
        founded: 1886,
        city: 'London',
        country: 'England',
        primary: '#EF0107',
        secondary: '#FFFFFF',
      },
      {
        leagueId: 1,
        name: 'Manchester United',
        short: 'MNU',
        founded: 1878,
        city: 'Manchester',
        country: 'England',
        primary: '#DA291C',
        secondary: '#FFFFFF',
      },
      {
        leagueId: 1,
        name: 'Chelsea',
        short: 'CHE',
        founded: 1905,
        city: 'London',
        country: 'England',
        primary: '#034694',
        secondary: '#FFFFFF',
      },
      {
        leagueId: 1,
        name: 'Leicester City',
        short: 'LEI',
        founded: 1884,
        city: 'Leicester',
        country: 'England',
        primary: '#003DA5',
        secondary: '#FFFFFF',
      },
      // Bundesliga clubs
      {
        leagueId: 2,
        name: 'FC Bayern München',
        short: 'BAY',
        founded: 1900,
        city: 'Munich',
        country: 'Germany',
        primary: '#DC143C',
        secondary: '#FFFFFF',
      },
      {
        leagueId: 2,
        name: 'Borussia Dortmund',
        short: 'DOR',
        founded: 1909,
        city: 'Dortmund',
        country: 'Germany',
        primary: '#FFD700',
        secondary: '#000000',
      },
      {
        leagueId: 2,
        name: 'RB Leipzig',
        short: 'RBL',
        founded: 2009,
        city: 'Leipzig',
        country: 'Germany',
        primary: '#003D7A',
        secondary: '#FFFFFF',
      },
      // Serie A clubs
      {
        leagueId: 3,
        name: 'Juventus',
        short: 'JUV',
        founded: 1897,
        city: 'Turin',
        country: 'Italy',
        primary: '#000000',
        secondary: '#FFFFFF',
      },
      {
        leagueId: 3,
        name: 'AC Milan',
        short: 'ACM',
        founded: 1899,
        city: 'Milan',
        country: 'Italy',
        primary: '#C60C30',
        secondary: '#000000',
      },
      {
        leagueId: 3,
        name: 'AS Roma',
        short: 'ROM',
        founded: 1927,
        city: 'Rome',
        country: 'Italy',
        primary: '#CE1126',
        secondary: '#FFD700',
      },
      // MLS clubs
      {
        leagueId: 4,
        name: 'LA Galaxy',
        short: 'LAG',
        founded: 1994,
        city: 'Los Angeles',
        country: 'USA',
        primary: '#003D7A',
        secondary: '#FDB913',
      },
      {
        leagueId: 4,
        name: 'Inter Miami CF',
        short: 'MIA',
        founded: 2020,
        city: 'Miami',
        country: 'USA',
        primary: '#000000',
        secondary: '#FF1493',
      },
      {
        leagueId: 4,
        name: 'Seattle Sounders',
        short: 'SEA',
        founded: 2007,
        city: 'Seattle',
        country: 'USA',
        primary: '#0C2C56',
        secondary: '#66B2D4',
      },
      // UCL (assigned to Bundesliga for reference)
      {
        leagueId: 5,
        name: 'Real Madrid',
        short: 'RM',
        founded: 1902,
        city: 'Madrid',
        country: 'Spain',
        primary: '#FFFFFF',
        secondary: '#000000',
      },
    ];

    const clubInserts = [];
    for (const club of clubsData) {
      const result = await client.query(
        `INSERT INTO clubs (league_id, club_name, short_name, founded_year, city, country, primary_color, secondary_color, adidas_partner)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING club_id`,
        [
          club.leagueId,
          club.name,
          club.short,
          club.founded,
          club.city,
          club.country,
          club.primary,
          club.secondary,
          true,
        ]
      );
      clubInserts.push({ ...club, id: result.rows[0].club_id });
      console.log(`  ✓ ${club.name}`);
    }

    // Insert jerseys
    console.log('\nInserting jerseys...');
    const jerseysData = [];
    const technologies = ['HEAT.RDY', 'AEROREADY'];
    const jersey_types = ['home', 'away', 'third'];

    // Data format: [clubId, leagueId]
    const clubLeagueMap = [
      [1, 1], // Arsenal
      [2, 1], // Manchester United
      [3, 1], // Chelsea
      [4, 1], // Leicester
      [5, 2], // Bayern
      [6, 2], // Dortmund
      [7, 2], // RB Leipzig
      [8, 3], // Juventus
      [9, 3], // AC Milan
      [10, 3], // Roma
      [11, 4], // LA Galaxy
      [12, 4], // Inter Miami
      [13, 4], // Seattle
      [14, 5], // Real Madrid
    ];

    let jerseyCounter = 0;
    for (const [clubIndex, [clubId, leagueId]] of clubLeagueMap.entries()) {
      const club = clubInserts[clubIndex];
      const clubName = club.name;

      // 2-3 jerseys per club
      const jerseyCount = clubIndex < 13 ? 3 : 2; // Real Madrid gets 2

      for (let i = 0; i < jerseyCount; i++) {
        const jerseyType = jersey_types[i % 3];
        const tech = technologies[i % 2];
        const basePrice = jerseyType === 'third' ? 100 : 110;
        const priceVariation = Math.floor(Math.random() * 21);
        const price = basePrice + priceVariation;

        // Generate product code: 2 letters + 4 digits
        const letters = clubName
          .split(' ')
          .map((word) => word[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();
        const productCode = letters + String(6000 + jerseyCounter).padStart(4, '0');

        // Random date between 2024-06-01 and 2024-09-01
        const startDate = new Date('2024-06-01');
        const endDate = new Date('2024-09-01');
        const randomDate = new Date(
          startDate.getTime() +
            Math.random() * (endDate.getTime() - startDate.getTime())
        );
        const releaseDate = randomDate.toISOString().split('T')[0];

        const jerseyName = `${clubName} ${jerseyType.charAt(0).toUpperCase() + jerseyType.slice(1)} Jersey 2024/25`;

        await client.query(
          `INSERT INTO jerseys 
           (club_id, league_id, product_code, season, jersey_type, name, price_usd, technology, in_stock, release_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            clubId,
            leagueId,
            productCode,
            '2024/25',
            jerseyType,
            jerseyName,
            price,
            tech,
            true,
            releaseDate,
          ]
        );

        console.log(
          `  ✓ ${jerseyName} (${productCode}) - $${price} - ${tech}`
        );
        jerseyCounter++;
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✓ Database seeding completed successfully!');
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run seed
seed()
  .then(() => {
    console.log('\nSetup complete. You can now start the server with: npm start');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
