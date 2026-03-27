import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import AuthShell from '@/components/AuthShell';
import { api } from '@/lib/api';
import { setPendingContact } from '@/lib/auth';
import { CITY_OPTIONS } from '@/lib/cities';

type Step = 1 | 2;

type GenderOption = '' | 'male' | 'female';

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState<GenderOption>('');
  const [familyStatus, setFamilyStatus] = useState<'celibataire' | 'marie' | ''>('');
  const [lookingFor, setLookingFor] = useState<'amour' | 'amitie' | ''>('');
  const [location, setLocation] = useState('');
  const [notice, setNotice] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);

  useEffect(() => {
    const query = location.trim();
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
          .filter((city) => city.toLowerCase().startsWith(query.toLowerCase()))
          .slice(0, 6);
        setCitySuggestions(fallback);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [location]);

  const goNext = () => {
    setNotice('');
    const missing: string[] = [];
    if (!lastName.trim()) missing.push('Nom');
    if (!birthdate.trim()) missing.push('Date de naissance');
    if (!gender) missing.push('Sexe');
    if (!familyStatus) missing.push('Statut matrimonial');
    if (!lookingFor) missing.push('Recherche');
    if (!location.trim()) missing.push('Ville');

    if (missing.length > 0) {
      setNotice(`Champs obligatoires manquants : ${missing.join(', ')}`);
      return;
    }
    setStep(2);
  };

  const register = async () => {
    setNotice('');
    const missing: string[] = [];
    if (!lastName.trim()) missing.push('Nom');
    if (!email.trim()) missing.push('Email');
    if (!phone.trim()) missing.push('Telephone');
    if (!password) missing.push('Mot de passe');
    if (!confirmPassword) missing.push('Confirmer mot de passe');
    if (!birthdate.trim()) missing.push('Date de naissance');
    if (!gender) missing.push('Sexe');
    if (!familyStatus) missing.push('Statut matrimonial');
    if (!lookingFor) missing.push('Recherche');
    if (!location.trim()) missing.push('Ville');

    if (missing.length > 0) {
      setNotice(`Champs obligatoires manquants : ${missing.join(', ')}`);
      return;
    }
    if (password.length < 6) {
      setNotice('Mot de passe trop court.');
      return;
    }
    if (password !== confirmPassword) {
      setNotice('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      const payload = {
        email: email.trim().toLowerCase(),
        phone: phone.trim().replace(/[^\d+]/g, ''),
        password,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        birthdate,
        gender,
        location,
        family_status: familyStatus,
        looking_for: lookingFor,
      };
      const data = await api.post('/auth/register', payload);
      setNotice(data.message || 'Compte cree.');
      await setPendingContact({ email: payload.email, phone: payload.phone });
      router.replace('/verify-account');
    } catch (err: any) {
      const raw = String(err?.message || '');
      let parsed = raw;
      try {
        const json = JSON.parse(raw);
        parsed = json?.error || raw;
      } catch {
        // ignore
      }
      setNotice(parsed || "Erreur d'inscription");
    }
  };

  return (
    <AuthShell
      title="Creer un compte"
      subtitle="Creez votre profil et lancez de nouvelles rencontres."
      notice={notice}
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Deja un compte ?</Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={styles.link}>Connexion</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.stepRow}>
        <Text style={styles.stepText}>Etape {step} / 2</Text>
      </View>

      {step === 1 ? (
        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Nom *</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Prenom</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Date de naissance *</Text>
              <Pressable style={styles.input} onPress={() => setShowDatePicker((v) => !v)}>
                <Text style={birthdate ? styles.inputText : styles.placeholderText}>
                  {birthdate || 'Choisir une date'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Sexe *</Text>
              <View style={styles.genderRow}>
                <Pressable
                  style={[styles.genderChip, gender === 'male' && styles.genderChipActive]}
                  onPress={() => setGender('male')}
                >
                  <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>
                    Homme
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.genderChip, gender === 'female' && styles.genderChipActive]}
                  onPress={() => setGender('female')}
                >
                  <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>
                    Femme
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Text style={styles.label}>Statut matrimonial *</Text>
          <View style={styles.genderRow}>
            <Pressable
              style={[styles.genderChip, familyStatus === 'celibataire' && styles.genderChipActive]}
              onPress={() => setFamilyStatus('celibataire')}
            >
              <Text style={[styles.genderText, familyStatus === 'celibataire' && styles.genderTextActive]}>
                Celibataire
              </Text>
            </Pressable>
            <Pressable
              style={[styles.genderChip, familyStatus === 'marie' && styles.genderChipActive]}
              onPress={() => setFamilyStatus('marie')}
            >
              <Text style={[styles.genderText, familyStatus === 'marie' && styles.genderTextActive]}>
                Marie(e)
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Ce que vous recherchez *</Text>
          <View style={styles.genderRow}>
            <Pressable
              style={[styles.genderChip, lookingFor === 'amour' && styles.genderChipActive]}
              onPress={() => setLookingFor('amour')}
            >
              <Text style={[styles.genderText, lookingFor === 'amour' && styles.genderTextActive]}>
                Amour
              </Text>
            </Pressable>
            <Pressable
              style={[styles.genderChip, lookingFor === 'amitie' && styles.genderChipActive]}
              onPress={() => setLookingFor('amitie')}
            >
              <Text style={[styles.genderText, lookingFor === 'amitie' && styles.genderTextActive]}>
                Amitie
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Ville *</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Ex: Douala"
          />
          {citySuggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {citySuggestions.map((city) => (
                <Pressable
                  key={city}
                  style={styles.suggestionItem}
                  onPress={() => {
                    setLocation(city);
                    setCitySuggestions([]);
                  }}
                >
                  <Text style={styles.suggestionText}>{city}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable style={styles.button} onPress={goNext}>
            <Text style={styles.buttonText}>Suivant</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Telephone *</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe *</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable style={styles.toggle} onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons
                    name={showPassword ? 'eye' : 'eye-off'}
                    size={20}
                    color="#ff5a5f"
                  />
                </Pressable>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Confirmer *</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <Pressable style={styles.toggle} onPress={() => setShowConfirmPassword((v) => !v)}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye' : 'eye-off'}
                    size={20}
                    color="#ff5a5f"
                  />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.buttonGhost} onPress={() => setStep(1)}>
              <Text style={styles.buttonGhostText}>Retour</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={register}>
              <Text style={styles.buttonText}>Creer mon compte</Text>
            </Pressable>
          </View>
        </View>
      )}

      {showDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={birthdate ? new Date(birthdate) : new Date(2000, 0, 1)}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (date) {
              setBirthdate(formatDate(date));
            }
          }}
        />
      ) : null}

      {showDatePicker && Platform.OS === 'ios' ? (
        <View style={styles.inlineDatePicker}>
          <Text style={styles.modalTitle}>Choisir la date</Text>
          <DateTimePicker
            value={birthdate ? new Date(birthdate) : new Date(2000, 0, 1)}
            mode="date"
            display="spinner"
            onChange={(_, date) => {
              if (date) {
                setBirthdate(formatDate(date));
              }
            }}
          />
          <Pressable
            style={styles.button}
            onPress={() => setShowDatePicker(false)}
          >
            <Text style={styles.buttonText}>Valider</Text>
          </Pressable>
        </View>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1a1a1d',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.1)',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  inputText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1a1a1d',
  },
  placeholderText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9aa0aa',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.1)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  genderChipActive: {
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
    borderColor: 'rgba(255, 90, 95, 0.5)',
  },
  genderText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1a1a1d',
  },
  genderTextActive: {
    color: '#ff5a5f',
  },
  suggestions: {
    marginTop: 6,
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
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1a1a1d',
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  toggle: {
    position: 'absolute',
    right: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#ff5a5f',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  buttonGhost: {
    marginTop: 8,
    backgroundColor: 'rgba(26, 26, 29, 0.08)',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    flex: 1,
  },
  buttonGhostText: {
    color: '#1a1a1d',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  link: {
    color: '#ff5a5f',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  footerText: {
    color: '#6b6b6b',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  stepRow: {
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  stepText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#5e6472',
  },
  inlineDatePicker: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.08)',
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1a1a1d',
  },
});
