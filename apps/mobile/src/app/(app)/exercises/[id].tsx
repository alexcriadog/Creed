import { useEffect, useState } from 'react';
import { ScrollView, Image, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText } from '@creed/ui-native';
import { getExercise, displayName, type Exercise } from '../../../lib/exercises';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getExercise(String(id))
      .then((e) => active && setExercise(e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Screen className="justify-center">
        <ActivityIndicator color="#4F62E0" />
      </Screen>
    );
  }
  if (!exercise) {
    return (
      <Screen className="justify-center">
        <AppText variant="muted">Ejercicio no encontrado.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-8">
        <AppText variant="title">{displayName(exercise)}</AppText>
        <AppText variant="muted">
          {[exercise.primary_muscle, exercise.equipment].filter(Boolean).join(' · ')}
        </AppText>
        {exercise.image_url ? (
          <Image source={{ uri: exercise.image_url }} className="w-full h-56 rounded-lg" resizeMode="cover" />
        ) : null}
        <View className="gap-2">
          {exercise.instructions.map((step, i) => (
            <AppText key={i}>
              {i + 1}. {step}
            </AppText>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
