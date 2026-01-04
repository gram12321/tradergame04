import { City } from './City.js';

export class CityRegistry {
    private static cities = new Map<string, City>();

    static registerCity(city: City): void {
        const key = `${city.name}, ${city.country}`;
        if (this.cities.has(key)) {
            throw new Error(`City already registered: ${key}`);
        }
        this.cities.set(key, city);
    }

    static getCity(name: string, country: string): City | undefined {
        const key = `${name}, ${country}`;
        return this.cities.get(key);
    }

    static getAllCities(): City[] {
        return Array.from(this.cities.values());
    }

    static getCitiesByCountry(country: string): City[] {
        return Array.from(this.cities.values()).filter(city => city.country === country);
    }

    static clear(): void {
        this.cities.clear();
    }
}

// Register initial cities
CityRegistry.registerCity(new City("Copenhagen", "Denmark", 0.9, 1000000));
CityRegistry.registerCity(new City("Aarhus", "Denmark", 0.85, 250000));
CityRegistry.registerCity(new City("Prague", "Czech Republic", 0.3, 1300000));
CityRegistry.registerCity(new City("Cairo", "Egypt", 0.1, 10000000));
