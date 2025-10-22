import { Audio } from 'expo-av';
import { Vibration } from 'react-native';

export const playSoundSequence = async (soundList, soundRefs) => {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
    });
    
    if (soundList.length === 0) return;
    
    const playNextSound = async (sounds) => {
      if (sounds.length === 0) return;
      
      const [currentSound, ...remainingSounds] = sounds;
      
      try {
        const { sound } = await Audio.Sound.createAsync(currentSound);
        
        soundRefs.current.push(sound);
        
        await sound.setVolumeAsync(1.0);
        await sound.playAsync();
        
        if (sounds.length === soundList.length) {
          Vibration.vibrate([0, 500, 200, 500]);
        }
        
        sound.setOnPlaybackStatusUpdate(async (status) => {
          if (status.didJustFinish) {
            await playNextSound(remainingSounds);
          }
        });
        
      } catch (error) {
        console.error('Error playing sound:', error);
        await playNextSound(remainingSounds);
      }
    };
    
    await playNextSound(soundList);
    
  } catch (error) {
    console.error("Error setting up sound sequence:", error);
  }
};

export const stopAllSounds = (soundRefs) => {
  soundRefs.current.forEach(sound => {
    sound?.unloadAsync();
  });
  soundRefs.current = [];
};