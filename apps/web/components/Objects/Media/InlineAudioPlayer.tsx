'use client'

import React from 'react'
import {
  Headphones,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { safePlay } from '@/lib/media/safePlay'

/*
 Compact audio player over the native <audio> element. Extracted from the Audio
 editor block so the Library preview and the Library block can play audio with
 the same controls; the Audio block imports it back from here.
*/

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
  return `${m}:${r.toString().padStart(2, '0')}`
}

function InlineAudioPlayer({ src, title }: { src: string; title?: string }) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const progressRef = React.useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [volume, setVolume] = React.useState(1)
  const [isMuted, setIsMuted] = React.useState(false)
  const [prevVolume, setPrevVolume] = React.useState(1)

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => setIsPlaying(false)

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else safePlay(audio)
  }

  const skip = (delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, duration))
  }

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isMuted) {
      audio.volume = prevVolume
      setVolume(prevVolume)
    } else {
      setPrevVolume(volume)
      audio.volume = 0
      setVolume(0)
    }
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (audioRef.current) audioRef.current.volume = v
    setVolume(v)
    setIsMuted(v === 0)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-white dark:bg-[#0b1116] border border-gray-200 dark:border-cyan-900/70 rounded-xl shadow-sm dark:shadow-black/30 overflow-hidden">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Title bar */}
      {title && (
        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
          <Headphones size={14} className="text-gray-400 dark:text-cyan-300 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900 dark:text-[#f4f7f8] truncate">{title}</span>
        </div>
      )}

      {/* Player controls */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Skip back */}
        <button
          type="button"
          onClick={() => skip(-15)}
          aria-label="Назад на 15 секунд"
          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
          title="Назад на 15 секунд"
        >
          <SkipBack size={16} className="text-gray-600 dark:text-[#d4dce3]" />
        </button>

        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          className="rounded-full bg-cyan-400 text-neutral-950 hover:bg-cyan-300 p-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
        >
          {isPlaying ? (
            <Pause size={16} className="text-neutral-950" fill="currentColor" />
          ) : (
            <Play size={16} className="text-neutral-950" fill="currentColor" />
          )}
        </button>

        {/* Skip forward */}
        <button
          type="button"
          onClick={() => skip(15)}
          aria-label="Вперёд на 15 секунд"
          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
          title="Вперёд на 15 секунд"
        >
          <SkipForward size={16} className="text-gray-600 dark:text-[#d4dce3]" />
        </button>

        {/* Time + Progress */}
        <span className="text-xs text-gray-500 dark:text-[#a0aec0] w-10 text-right tabular-nums flex-shrink-0">
          {formatTime(currentTime)}
        </span>

        <div
          ref={progressRef}
          onClick={seekTo}
          aria-label="Позиция воспроизведения"
          className="min-w-[7rem] basis-[35%] sm:basis-0 flex-1 h-1.5 bg-gray-200 dark:bg-neutral-700 rounded-full cursor-pointer relative group"
        >
          <div
            className="h-full bg-gray-900 dark:bg-cyan-300 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-900 dark:bg-cyan-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        <span className="text-xs text-gray-500 dark:text-[#a0aec0] w-10 tabular-nums flex-shrink-0">
          {formatTime(duration)}
        </span>

        {/* Volume */}
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted || volume === 0 ? 'Включить звук' : 'Выключить звук'}
          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={16} className="text-gray-600 dark:text-[#d4dce3]" />
          ) : (
            <Volume2 size={16} className="text-gray-600 dark:text-[#d4dce3]" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          aria-label="Громкость"
          className="hidden sm:block w-16 h-1 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-gray-900 dark:accent-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400"
        />
      </div>
    </div>
  )
}

export default InlineAudioPlayer
