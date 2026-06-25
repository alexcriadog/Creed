import { useEffect, useState } from 'react';
import { FlatList, TextInput, View, Image, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText } from '@creed/ui-native';
import { listExercises, displayName, type Exercise } from '../../../lib/exercises';

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'abs'];

export default function ExercisesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listExercises({ search: search || undefined, muscle: muscle || undefined })
      .then((r) => active && setItems(r))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [search, muscle]);

  return (
    <Screen className="gap-4">
      <AppText variant="title">Ejercicios</AppText>
      <TextInput
        testID="search-input"
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar ejercicio…"
        className="h-12 rounded-lg border border-border px-4 text-text-primary"
      />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={MUSCLES}
        keyExtractor={(m) => m}
        className="max-h-10"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setMuscle(muscle === item ? null : item)}
            className={`mr-2 h-9 rounded-pill px-4 justify-center ${muscle === item ? 'bg-accent' : 'bg-surface border border-border'}`}
          >
            <AppText className={muscle === item ? 'text-text-on-accent' : 'text-text-secondary'}>{item}</AppText>
          </Pressable>
        )}
      />
      {loading ? (
        <ActivityIndicator color="#4F62E0" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => e.id}
          contentContainerClassName="gap-2 pb-8"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/exercises/${item.id}`)}
              className="flex-row items-center gap-3 bg-surface border border-border rounded-lg p-3 active:opacity-80"
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="w-12 h-12 rounded-md" />
              ) : (
                <View className="w-12 h-12 rounded-md bg-canvas-tint" />
              )}
              <View className="flex-1">
                <AppText>{displayName(item)}</AppText>
                <AppText variant="muted">{item.primary_muscle ?? ''}</AppText>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<AppText variant="muted">Sin resultados.</AppText>}
        />
      )}
    </Screen>
  );
}
