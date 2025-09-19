import * as Location from 'expo-location';
import { supabase } from './supabase';

export interface LocationContext {
  type: 'home' | 'work' | 'travel' | 'unknown';
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  confidence: number;
  lastUpdated: Date;
}

export interface LocationBasedTopic {
  location: LocationContext;
  topics: string[];
  conversationStarters: string[];
}

export class LocationService {
  private static instance: LocationService;
  private currentLocation: LocationContext | null = null;
  private knownLocations: Map<string, LocationContext> = new Map();
  private readonly LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async getCurrentLocation(): Promise<LocationContext | null> {
    try {
      // Check if we have recent location data
      if (this.currentLocation && 
          Date.now() - this.currentLocation.lastUpdated.getTime() < this.LOCATION_CACHE_DURATION) {
        return this.currentLocation;
      }

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return this.getDefaultLocation();
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Reverse geocode to get address
      const address = await this.reverseGeocode(coordinates);
      
      // Determine location type
      const locationType = await this.determineLocationType(coordinates, address);

      this.currentLocation = {
        type: locationType,
        coordinates,
        address,
        confidence: 0.8,
        lastUpdated: new Date(),
      };

      // Store location data for learning
      await this.storeLocationData(this.currentLocation);

      return this.currentLocation;
    } catch (error) {
      console.error('Error getting location:', error);
      return this.getDefaultLocation();
    }
  }

  private async reverseGeocode(coordinates: { latitude: number; longitude: number }): Promise<string> {
    try {
      const result = await Location.reverseGeocodeAsync(coordinates);
      if (result.length > 0) {
        const addr = result[0];
        return `${addr.street || ''} ${addr.city || ''} ${addr.region || ''}`.trim();
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
    return 'Unknown location';
  }

  private async determineLocationType(
    coordinates: { latitude: number; longitude: number },
    address: string
  ): Promise<'home' | 'work' | 'travel' | 'unknown'> {
    // Check against known locations
    const locationKey = `${coordinates.latitude.toFixed(3)},${coordinates.longitude.toFixed(3)}`;
    
    if (this.knownLocations.has(locationKey)) {
      return this.knownLocations.get(locationKey)!.type;
    }

    // Load user's known locations from database
    const knownLocations = await this.getUserKnownLocations();
    
    // Check if current location matches any known location (within ~100m)
    for (const known of knownLocations) {
      if (known.coordinates) {
        const distance = this.calculateDistance(coordinates, known.coordinates);
        if (distance < 0.1) { // Within 100 meters
          this.knownLocations.set(locationKey, known);
          return known.type;
        }
      }
    }

    // Use heuristics to guess location type
    return this.guessLocationType(address, coordinates);
  }

  private guessLocationType(
    address: string,
    coordinates: { latitude: number; longitude: number }
  ): 'home' | 'work' | 'travel' | 'unknown' {
    const hour = new Date().getHours();
    const addressLower = address.toLowerCase();

    // Time-based heuristics
    if (hour >= 22 || hour <= 7) {
      return 'home'; // Late night/early morning likely home
    }
    
    if (hour >= 9 && hour <= 17) {
      // Business hours - could be work
      if (addressLower.includes('office') || 
          addressLower.includes('business') || 
          addressLower.includes('corporate')) {
        return 'work';
      }
    }

    // Location-based heuristics
    if (addressLower.includes('airport') || 
        addressLower.includes('hotel') || 
        addressLower.includes('resort')) {
      return 'travel';
    }

    return 'unknown';
  }

  private calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private async getUserKnownLocations(): Promise<LocationContext[]> {
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .order('confidence', { ascending: false });

      if (error) throw error;

      return data?.map(loc => ({
        type: loc.location_type,
        coordinates: loc.latitude && loc.longitude ? {
          latitude: loc.latitude,
          longitude: loc.longitude,
        } : undefined,
        address: loc.address,
        confidence: loc.confidence,
        lastUpdated: new Date(loc.updated_at),
      })) || [];
    } catch (error) {
      console.error('Error fetching known locations:', error);
      return [];
    }
  }

  private async storeLocationData(location: LocationContext): Promise<void> {
    try {
      const locationData = {
        location_type: location.type,
        latitude: location.coordinates?.latitude,
        longitude: location.coordinates?.longitude,
        address: location.address,
        confidence: location.confidence,
        visit_count: 1,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('user_locations')
        .upsert(locationData, { 
          onConflict: 'latitude,longitude',
          ignoreDuplicates: false 
        });
    } catch (error) {
      console.error('Error storing location data:', error);
    }
  }

  private getDefaultLocation(): LocationContext {
    return {
      type: 'unknown',
      confidence: 0.1,
      lastUpdated: new Date(),
    };
  }

  getLocationBasedTopics(location: LocationContext, userInterests: string[]): LocationBasedTopic {
    const baseTopics = this.getTopicsForLocationType(location.type);
    const personalizedTopics = this.personalizeTopics(baseTopics, userInterests);
    
    return {
      location,
      topics: personalizedTopics,
      conversationStarters: this.generateLocationConversationStarters(location, personalizedTopics),
    };
  }

  private getTopicsForLocationType(type: LocationContext['type']): string[] {
    const topicMap: Record<LocationContext['type'], string[]> = {
      home: [
        'personal development',
        'family relationships',
        'home improvement',
        'cooking and nutrition',
        'relaxation techniques',
        'evening reflection',
        'weekend planning',
        'creative hobbies',
        'health and wellness',
        'financial planning'
      ],
      work: [
        'productivity tips',
        'career development',
        'workplace dynamics',
        'professional skills',
        'industry trends',
        'networking strategies',
        'work-life balance',
        'leadership insights',
        'innovation ideas',
        'team collaboration'
      ],
      travel: [
        'cultural experiences',
        'travel photography',
        'local cuisine exploration',
        'historical insights',
        'language learning',
        'adventure planning',
        'cultural differences',
        'travel safety',
        'memorable experiences',
        'personal growth through travel'
      ],
      unknown: [
        'current events',
        'general knowledge',
        'philosophical questions',
        'science discoveries',
        'technology trends',
        'creative thinking',
        'problem solving',
        'life perspectives',
        'interesting facts',
        'thought experiments'
      ]
    };

    return topicMap[type] || topicMap.unknown;
  }

  private personalizeTopics(baseTopics: string[], userInterests: string[]): string[] {
    // Combine base topics with user interests, prioritizing matches
    const personalizedTopics = [...baseTopics];
    
    userInterests.forEach(interest => {
      if (!personalizedTopics.some(topic => 
        topic.toLowerCase().includes(interest.toLowerCase()) ||
        interest.toLowerCase().includes(topic.toLowerCase())
      )) {
        personalizedTopics.push(interest);
      }
    });

    return personalizedTopics.slice(0, 8); // Limit to top 8 topics
  }

  private generateLocationConversationStarters(
    location: LocationContext, 
    topics: string[]
  ): string[] {
    const starters: string[] = [];
    const locationType = location.type;
    const timeOfDay = this.getTimeOfDay();

    // Location and time-specific starters
    const starterTemplates: Record<string, string[]> = {
      home: [
        `Since you're at home this ${timeOfDay}, what's one small thing you could do to make your space more comfortable?`,
        `Perfect time for some personal reflection - what's been on your mind lately?`,
        `What's a skill you've always wanted to learn that you could start practicing at home?`,
        `How do you like to unwind when you're in your personal space?`
      ],
      work: [
        `What's the most interesting challenge you're working on right now?`,
        `If you could change one thing about your work environment, what would it be?`,
        `What's a professional skill you'd like to develop further?`,
        `How do you stay motivated during busy workdays?`
      ],
      travel: [
        `What's the most surprising thing you've discovered about this place?`,
        `How does this location compare to what you expected?`,
        `What local custom or tradition have you found most interesting?`,
        `What would you recommend about this place to a friend?`
      ],
      unknown: [
        `What's something interesting you've learned recently?`,
        `If you could have a conversation with anyone right now, who would it be and why?`,
        `What's a question you've been pondering lately?`,
        `What's something that's caught your attention in the news recently?`
      ]
    };

    const locationStarters = starterTemplates[locationType] || starterTemplates.unknown;
    starters.push(...locationStarters.slice(0, 2));

    // Topic-based starters
    topics.slice(0, 3).forEach(topic => {
      starters.push(`I noticed you're interested in ${topic}. What aspect of it fascinates you most?`);
    });

    return starters;
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  async setUserLocation(type: 'home' | 'work', coordinates?: { latitude: number; longitude: number }): Promise<void> {
    try {
      const currentCoords = coordinates || this.currentLocation?.coordinates;
      if (!currentCoords) return;

      const address = await this.reverseGeocode(currentCoords);
      
      await supabase
        .from('user_locations')
        .upsert({
          location_type: type,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          address,
          confidence: 1.0,
          visit_count: 1,
          updated_at: new Date().toISOString(),
        });

      // Update local cache
      const locationKey = `${currentCoords.latitude.toFixed(3)},${currentCoords.longitude.toFixed(3)}`;
      this.knownLocations.set(locationKey, {
        type,
        coordinates: currentCoords,
        address,
        confidence: 1.0,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Error setting user location:', error);
    }
  }

  // Clear cached location data
  async clearCache(): Promise<void> {
    try {
      this.currentLocation = null;
      this.knownLocations.clear();
      console.log('Location cache cleared');
    } catch (error) {
      console.error('Error clearing location cache:', error);
    }
  }
}

export const locationService = LocationService.getInstance();
