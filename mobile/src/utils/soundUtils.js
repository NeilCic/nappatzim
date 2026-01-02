import { Audio } from "expo-av";
import { Vibration } from "react-native";

export const playSound = async (sound, soundRef) => {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
    });

    const { sound: createdSound } = await Audio.Sound.createAsync(sound);
    soundRef.current = createdSound;
    await createdSound.setVolumeAsync(1.0);
    await createdSound.playAsync();
    Vibration.vibrate([0, 500, 200, 500]);
  } catch (error) {
    // Sound playback failed, silently continue
  }
};

export const stopSound = async (soundRef) => {
  const sound = soundRef.current;
  if (!sound) return;
  soundRef.current = null;

  sound.setOnPlaybackStatusUpdate(null);
  await sound.unloadAsync(); 
};
