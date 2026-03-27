import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api } from '@/lib/api';
import { CITY_OPTIONS } from '@/lib/cities';
import { clearFilters, getFilters, setFilters } from '@/lib/filters';

const CHILDREN_OPTIONS = ['any', '0', '1', '2', '3plus'];
const SMOKER_OPTIONS = ['any', 'yes', 'no'];
const RELIGION_OPTIONS = ['any', 'catholique', 'protestant', 'musulman'];

const labelChildren = (value: string) => {
  if (value === 'any') return 'Tous';
  if (value === '3plus') return '3+';
  return value;
};

const labelSmoker = (value: string) => {
  if (value === 'any') return 'Tous';
  return value === 'yes' ? 'Fumeur' : 'Non fumeur';
};

const labelReligion = (value: string) => {
  if (value === 'any') return 'Toutes';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function FiltersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [city, setCity] = useState('');
  const [children, setChildren] = useState('any');
  const [smoker, setSmoker] = useState('any');
  const [religion, setReligion] = useState('any');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const saved = await getFilters();
      setAgeMin(saved.ageMin || '');
      setAgeMax(saved.ageMax || '');
      setCity(saved.city || '');
      setChildren(saved.children || 'any');
      setSmoker(saved.smoker || 'any');
      setReligion(saved.religion || 'any');
    };
    load();
  }, []);

  useEffect(() => {
    const query = city.trim();
    if (!query) {
      setCitySuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const data = await api.get(`/profile/cities?q=${encodeURIComponent(query)}`);
        const list = Array.isArray(data) ? data : data?.cities;
        if (Array.isArray(list)) {
          setCitySuggestions(list);
          return;
        }
        throw new Error('Invalid cities response');
      } catch {
        const fallback = CITY_OPTIONS
          .filter((item) => item.toLowerCase().startsWith(query.toLowerCase()))
          .slice(0, 6);
        setCitySuggestions(fallback);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [city]);

  const apply = async () => {
    await setFilters({
      ageMin: ageMin.trim(),
      ageMax: ageMax.trim(),
      city: city.trim(),
      children: children === 'any' ? '' : children,
      smoker: smoker === 'any' ? '' : smoker,
      religion: religion === 'any' ? '' : religion,
    });
    router.back();
  };

  const reset = async () => {
    await clearFilters();
    setAgeMin('');
    setAgeMax('');
    setCity('');
    setChildren('any');
    setSmoker('any');
    setReligion('any');
    router.back();
  };

  const hasCitySuggestions = useMemo(() => citySuggestions.length > 0, [citySuggestions]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Filtres</Text>
        <Pressable onPress={reset} style={styles.resetButton}>
          <Text style={styles.resetText}>Reinitialiser</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}> 
        <Text style={styles.sectionTitle}>Age</Text>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Min</Text>
            <TextInput
              style={styles.input}
              value={ageMin}
              onChangeText={setAgeMin}
              keyboardType="number-pad"
              placeholder="18"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Max</Text>
            <TextInput
              style={styles.input}
              value={ageMax}
              onChangeText={setAgeMax}
              keyboardType="number-pad"
              placeholder="55"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ville</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Ex: Douala"
        />
        {hasCitySuggestions ? (
          <View style={styles.suggestions}>
            {citySuggestions.map((item) => (
              <Pressable
                key={item}
                style={styles.suggestionItem}
                onPress={() => {
                  setCity(item);
                  setCitySuggestions([]);
                }}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Enfants</Text>
        <View style={styles.chipRow}>
          {CHILDREN_OPTIONS.map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, children === value && styles.chipActive]}
              onPress={() => setChildren(value)}
            >
              <Text style={[styles.chipText, children === value && styles.chipTextActive]}>
                {labelChildren(value)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Fumeur</Text>
        <View style={styles.chipRow}>
          {SMOKER_OPTIONS.map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, smoker === value && styles.chipActive]}
              onPress={() => setSmoker(value)}
            >
              <Text style={[styles.chipText, smoker === value && styles.chipTextActive]}>
                {labelSmoker(value)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Religion</Text>
        <View style={styles.chipRow}>
          {RELIGION_OPTIONS.map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, religion === value && styles.chipActive]}
              onPress={() => setReligion(value)}
            >
              <Text style={[styles.chipText, religion === value && styles.chipTextActive]}>
                {labelReligion(value)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.applyButton} onPress={apply}>
          <Text style={styles.applyText}>Appliquer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 26, 29, 0.05)',
  },
  resetButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 26, 29, 0.05)',
  },
  resetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff5a5f',
  },
  card: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.1)',
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#fff',
  },
  suggestions: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.08)',
    padding: 8,
    gap: 6,
  },
  suggestionItem: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(26, 26, 29, 0.04)',
  },
  suggestionText: {
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
    borderColor: 'rgba(255, 90, 95, 0.5)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1d',
  },
  chipTextActive: {
    color: '#ff5a5f',
  },
  applyButton: {
    marginTop: 6,
    backgroundColor: '#ff5a5f',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  applyText: {
    color: '#fff',
    fontWeight: '700',
  },
});
