/**
 * Demo 7: Location Services (Geospatial)
 * 
 * Demonstrates Redis Geospatial features for location-based services:
 * - Store locations with coordinates
 * - Calculate distances between points
 * - Find nearby locations
 * - Proximity search
 * - Real-world use cases (stores, delivery, etc.)
 * 
 * Run with: bun run demos/07-location-services.ts
 */

import { createRedis, createNamespacedRedis } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface Location {
  name: string;
  longitude: number;
  latitude: number;
  category?: string;
}

interface LocationWithDistance {
  name: string;
  distance: number;
  coordinates: [number, number];
}

// ============================================================================
// Location Service Class
// ============================================================================

class LocationService {
  private locations;

  constructor(redis: any) {
    this.locations = createNamespacedRedis(redis, "locations");
  }

  /**
   * Add a location with coordinates
   */
  async addLocation(
    setName: string,
    name: string,
    longitude: number,
    latitude: number
  ): Promise<void> {
    await this.locations.geoadd(setName, [longitude, latitude, name]);
    console.log(`  📍 Added ${name} at [${latitude}, ${longitude}]`);
  }

  /**
   * Add multiple locations at once
   */
  async addLocations(setName: string, locations: Location[]): Promise<void> {
    const entries: [number, number, string][] = locations.map(loc => [
      loc.longitude,
      loc.latitude,
      loc.name
    ]);

    await this.locations.geoadd(setName, ...entries);
    console.log(`  📍 Added ${locations.length} locations to ${setName}`);
  }

  /**
   * Get distance between two locations
   */
  async getDistance(
    setName: string,
    location1: string,
    location2: string,
    unit: "m" | "km" | "mi" | "ft" = "km"
  ): Promise<number | null> {
    const distance = await this.locations.geodist(setName, location1, location2, unit);
    return distance ? Number(distance) : null;
  }

  /**
   * Get coordinates of a location
   */
  async getCoordinates(
    setName: string,
    locationName: string
  ): Promise<[number, number] | null> {
    const positions = await this.locations.geopos(setName, locationName);
    
    if (positions && positions[0] && Array.isArray(positions[0])) {
      const [lng, lat] = positions[0];
      return [Number(lng), Number(lat)];
    }
    
    return null;
  }

  /**
   * Find nearby locations within radius
   * Note: GEORADIUS is deprecated, but still commonly used
   * For production, consider using GEOSEARCH
   */
  async findNearby(
    setName: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: "m" | "km" | "mi" | "ft" = "km"
  ): Promise<string[]> {
    try {
      const results = await this.locations.georadius(
        setName,
        longitude,
        latitude,
        radius,
        unit
      );
      return results || [];
    } catch (error) {
      console.error("Error finding nearby locations:", error);
      return [];
    }
  }

  /**
   * Find nearby locations with distance info
   */
  async findNearbyWithDistance(
    setName: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: "m" | "km" | "mi" | "ft" = "km"
  ): Promise<LocationWithDistance[]> {
    try {
      const results = await this.locations.command<any[]>(
        "GEORADIUS",
        setName,
        longitude,
        latitude,
        radius,
        unit,
        "WITHDIST",
        "WITHCOORD"
      );

      if (!results || !Array.isArray(results)) return [];

      const locations: LocationWithDistance[] = [];
      
      for (const result of results) {
        if (Array.isArray(result) && result.length >= 3) {
          const name = String(result[0]);
          const distance = Number(result[1]);
          const coords = result[2];
          
          if (Array.isArray(coords) && coords.length === 2) {
            locations.push({
              name,
              distance,
              coordinates: [Number(coords[0]), Number(coords[1])]
            });
          }
        }
      }

      return locations;
    } catch (error) {
      console.error("Error finding nearby with distance:", error);
      return [];
    }
  }

  /**
   * Find locations near another location
   */
  async findNearLocation(
    setName: string,
    centerLocation: string,
    radius: number,
    unit: "m" | "km" | "mi" | "ft" = "km"
  ): Promise<string[]> {
    try {
      const results = await this.locations.command<string[]>(
        "GEORADIUSBYMEMBER",
        setName,
        centerLocation,
        radius,
        unit
      );
      return results || [];
    } catch (error) {
      console.error("Error finding near location:", error);
      return [];
    }
  }

  /**
   * Remove a location
   */
  async removeLocation(setName: string, locationName: string): Promise<void> {
    await this.locations.zrem(setName, locationName);
    console.log(`  🗑️  Removed ${locationName}`);
  }

  /**
   * Get total locations in set
   */
  async getLocationCount(setName: string): Promise<number> {
    return await this.locations.zcard(setName);
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function main() {
  console.log("🗺️  Demo 7: Location Services (Geospatial)\n");

  await using redis = await createRedis("redis://localhost:6379");
  const locationService = new LocationService(redis);

  // ============================================================================
  // Use Case 1: Store Locator
  // ============================================================================
  console.log("🏪 Use Case 1: Store Locator");
  console.log("─────────────────────────────────────────");

  console.log("\nAdding store locations...\n");

  const stores: Location[] = [
    { name: "Store:Downtown", longitude: -122.4194, latitude: 37.7749 }, // San Francisco
    { name: "Store:Marina", longitude: -122.4376, latitude: 37.8044 },    // SF Marina
    { name: "Store:SoMa", longitude: -122.3959, latitude: 37.7819 },      // SF SoMa
    { name: "Store:Oakland", longitude: -122.2712, latitude: 37.8044 },   // Oakland
    { name: "Store:Berkeley", longitude: -122.2728, latitude: 37.8715 },  // Berkeley
    { name: "Store:SanJose", longitude: -121.8863, latitude: 37.3382 },   // San Jose
  ];

  await locationService.addLocations("stores", stores);

  // ============================================================================
  // Feature 1: Distance Calculation
  // ============================================================================
  console.log("\n\n📏 Feature 1: Distance Between Stores");
  console.log("─────────────────────────────────────────");

  const distance = await locationService.getDistance(
    "stores",
    "Store:Downtown",
    "Store:Oakland",
    "km"
  );

  console.log(`\nDistance from Downtown to Oakland: ${distance?.toFixed(2)} km`);

  const milesDistance = await locationService.getDistance(
    "stores",
    "Store:Downtown",
    "Store:SanJose",
    "mi"
  );

  console.log(`Distance from Downtown to San Jose: ${milesDistance?.toFixed(2)} miles`);

  // ============================================================================
  // Feature 2: Get Coordinates
  // ============================================================================
  console.log("\n\n📍 Feature 2: Location Coordinates");
  console.log("─────────────────────────────────────────");

  const downtownCoords = await locationService.getCoordinates("stores", "Store:Downtown");
  if (downtownCoords) {
    console.log(`\nStore:Downtown coordinates:`);
    console.log(`  Longitude: ${downtownCoords[0].toFixed(4)}`);
    console.log(`  Latitude: ${downtownCoords[1].toFixed(4)}`);
  }

  // ============================================================================
  // Feature 3: Find Nearby Stores
  // ============================================================================
  console.log("\n\n🔍 Feature 3: Find Nearby Stores");
  console.log("─────────────────────────────────────────");

  // Customer location (SF Financial District)
  const customerLng = -122.3990;
  const customerLat = 37.7900;

  console.log(`\nCustomer location: [${customerLat}, ${customerLng}]`);
  console.log("Finding stores within 5km radius...\n");

  const nearbyStores = await locationService.findNearby(
    "stores",
    customerLng,
    customerLat,
    5,
    "km"
  );

  console.log(`Found ${nearbyStores.length} stores:`);
  nearbyStores.forEach((store, i) => {
    console.log(`  ${i + 1}. ${store}`);
  });

  // ============================================================================
  // Feature 4: Find Nearby with Distance
  // ============================================================================
  console.log("\n\n📊 Feature 4: Nearby Stores with Distance");
  console.log("─────────────────────────────────────────");

  const storesWithDistance = await locationService.findNearbyWithDistance(
    "stores",
    customerLng,
    customerLat,
    10,
    "km"
  );

  console.log("\nStores within 10km (sorted by distance):");
  storesWithDistance
    .sort((a, b) => a.distance - b.distance)
    .forEach((store, i) => {
      console.log(`  ${i + 1}. ${store.name}`);
      console.log(`     Distance: ${store.distance.toFixed(2)} km`);
      console.log(`     Location: [${store.coordinates[1].toFixed(4)}, ${store.coordinates[0].toFixed(4)}]`);
    });

  // ============================================================================
  // Feature 5: Find Stores Near Another Store
  // ============================================================================
  console.log("\n\n🏪 Feature 5: Stores Near Downtown");
  console.log("─────────────────────────────────────────");

  const nearDowntown = await locationService.findNearLocation(
    "stores",
    "Store:Downtown",
    10,
    "km"
  );

  console.log(`\nStores within 10km of Downtown store:`);
  nearDowntown.forEach((store, i) => {
    console.log(`  ${i + 1}. ${store}`);
  });

  // ============================================================================
  // Use Case 2: Delivery Service
  // ============================================================================
  console.log("\n\n🚚 Use Case 2: Delivery Service");
  console.log("─────────────────────────────────────────");

  console.log("\nAdding delivery drivers...\n");

  const drivers: Location[] = [
    { name: "Driver:Alice", longitude: -122.4100, latitude: 37.7850 },
    { name: "Driver:Bob", longitude: -122.3950, latitude: 37.7920 },
    { name: "Driver:Charlie", longitude: -122.4250, latitude: 37.7700 },
  ];

  await locationService.addLocations("drivers", drivers);

  // Delivery destination
  const deliveryLng = -122.4000;
  const deliveryLat = 37.7880;

  console.log(`Delivery destination: [${deliveryLat}, ${deliveryLng}]`);
  console.log("Finding nearest available drivers...\n");

  const nearbyDrivers = await locationService.findNearbyWithDistance(
    "drivers",
    deliveryLng,
    deliveryLat,
    5,
    "km"
  );

  console.log("Available drivers (sorted by proximity):");
  nearbyDrivers
    .sort((a, b) => a.distance - b.distance)
    .forEach((driver, i) => {
      const eta = Math.ceil(driver.distance * 2); // Rough ETA: 2 min per km
      console.log(`  ${i + 1}. ${driver.name}`);
      console.log(`     Distance: ${driver.distance.toFixed(2)} km`);
      console.log(`     ETA: ~${eta} minutes`);
    });

  // ============================================================================
  // Use Case 3: Restaurant Finder
  // ============================================================================
  console.log("\n\n🍕 Use Case 3: Restaurant Finder");
  console.log("─────────────────────────────────────────");

  console.log("\nAdding restaurants...\n");

  const restaurants: Location[] = [
    { name: "Pizza Palace", longitude: -122.4200, latitude: 37.7750 },
    { name: "Burger King", longitude: -122.4150, latitude: 37.7800 },
    { name: "Sushi Bar", longitude: -122.3980, latitude: 37.7850 },
    { name: "Taco Truck", longitude: -122.4050, latitude: 37.7820 },
    { name: "Pasta House", longitude: -122.4300, latitude: 37.7700 },
  ];

  await locationService.addLocations("restaurants", restaurants);

  // User location
  const userLng = -122.4100;
  const userLat = 37.7800;

  console.log(`Your location: [${userLat}, ${userLng}]`);
  console.log("Finding restaurants within 2km...\n");

  const nearbyRestaurants = await locationService.findNearbyWithDistance(
    "restaurants",
    userLng,
    userLat,
    2,
    "km"
  );

  console.log("Nearby restaurants:");
  nearbyRestaurants
    .sort((a, b) => a.distance - b.distance)
    .forEach((restaurant, i) => {
      const walkTime = Math.ceil(restaurant.distance * 12); // 12 min per km walking
      console.log(`  ${i + 1}. ${restaurant.name}`);
      console.log(`     Distance: ${restaurant.distance.toFixed(2)} km`);
      console.log(`     Walk time: ~${walkTime} minutes`);
    });

  // ============================================================================
  // Use Case 4: Real Estate Search
  // ============================================================================
  console.log("\n\n🏠 Use Case 4: Real Estate Property Search");
  console.log("─────────────────────────────────────────");

  console.log("\nAdding properties...\n");

  const properties: Location[] = [
    { name: "Prop:123MainSt", longitude: -122.4180, latitude: 37.7760 },
    { name: "Prop:456OakAve", longitude: -122.4220, latitude: 37.7790 },
    { name: "Prop:789PineSt", longitude: -122.4050, latitude: 37.7830 },
  ];

  await locationService.addLocations("properties", properties);

  // Search near popular landmark (e.g., Golden Gate Park)
  const parkLng = -122.4862;
  const parkLat = 37.7694;

  console.log(`Searching near Golden Gate Park: [${parkLat}, ${parkLng}]`);
  console.log("Finding properties within 10km...\n");

  const nearbyProperties = await locationService.findNearbyWithDistance(
    "properties",
    parkLng,
    parkLat,
    10,
    "km"
  );

  console.log("Properties near Golden Gate Park:");
  nearbyProperties.forEach((prop, i) => {
    console.log(`  ${i + 1}. ${prop.name}`);
    console.log(`     Distance to park: ${prop.distance.toFixed(2)} km`);
  });

  // ============================================================================
  // Statistics
  // ============================================================================
  console.log("\n\n📊 Location Statistics");
  console.log("─────────────────────────────────────────");

  const storeCount = await locationService.getLocationCount("stores");
  const driverCount = await locationService.getLocationCount("drivers");
  const restaurantCount = await locationService.getLocationCount("restaurants");
  const propertyCount = await locationService.getLocationCount("properties");

  console.log(`\nStores: ${storeCount}`);
  console.log(`Drivers: ${driverCount}`);
  console.log(`Restaurants: ${restaurantCount}`);
  console.log(`Properties: ${propertyCount}`);

  // ============================================================================
  // Best Practices Summary
  // ============================================================================
  console.log("\n\n💡 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Store coordinates in [longitude, latitude] order");
  console.log("  ✓ Use GEOADD to add locations");
  console.log("  ✓ Use GEODIST to calculate distances");
  console.log("  ✓ Use GEORADIUS for proximity search");
  console.log("  ✓ Choose appropriate radius units (m, km, mi, ft)");
  console.log("  ✓ Consider pagination for large result sets");
  console.log("  ✓ Cache frequently queried locations");
  console.log("  ✓ Update locations when entities move (drivers, vehicles)");
  console.log("  ✓ Use separate sets for different entity types");

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");
  const keys = await locationService["locations"].scanAll("*");
  if (keys.length > 0) {
    await locationService["locations"].del(...keys);
  }

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
