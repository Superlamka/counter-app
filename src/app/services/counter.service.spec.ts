import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedCounter } from '../models/saved-counter';
import { CounterService } from './counter.service';

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('CounterService', () => {
  let service: CounterService;

  const getMock = vi.mocked(Preferences.get);
  const setMock = vi.mocked(Preferences.set);
  const removeMock = vi.mocked(Preferences.remove);

  const first: SavedCounter = {
    id: 'first',
    name: 'První',
    value: 1,
    createdAt: '2026-09-17T08:00:00.000Z',
  };

  const second: SavedCounter = {
    id: 'second',
    name: 'Druhé',
    value: 2,
    createdAt: '2026-09-17T09:00:00.000Z',
  };

  beforeEach(() => {
    // Vynulujeme počty volání mocků z předchozího testu.
    vi.clearAllMocks();

    // Výchozí stav: v Preferences zatím není uložená historie.
    getMock.mockResolvedValue({ value: null });

    // Zápis i odstranění ve výchozím stavu úspěšně skončí.
    setMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);

    // Pro každý test vytvoříme nové prostředí Angular dependency injection.
    TestBed.configureTestingModule({
      providers: [CounterService],
    });

    // Z testovacího injectoru získáme čerstvou instanci služby.
    service = TestBed.inject(CounterService);
  });

  it('should initialize only once', async () => {
    // Dvě volání bez čekání simulují souběžné požadavky na inicializaci.
    await Promise.all([service.initialize(), service.initialize()]);

    // Další volání proběhne až po dokončení první inicializace.
    await service.initialize();

    // Všechna volání musí sdílet jedinou operaci načtení Preferences.
    expect(getMock).toHaveBeenCalledTimes(1);

    // Služba dokončila inicializaci a při value: null má prázdnou historii.
    expect(service.initialized()).toBe(true);
    expect(service.counters()).toEqual([]);
  });

  it('should load saved counters during initialization', async () => {
    // Simulujeme JSON s uloženými záznamy.
    getMock.mockResolvedValue({
      value: JSON.stringify([first, second]),
    });

    await service.initialize();

    // Uložená data jsou dostupná prostřednictvím veřejného signálu.
    expect(service.counters()).toEqual([first, second]);
    expect(service.initialized()).toBe(true);

    // Inicializace načte uloženou hodnotu z Preferences.
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('should add a counter at the beginning and persist it', async () => {
    getMock.mockResolvedValue({
      value: JSON.stringify([first, second]),
    });

    await service.initialize();

    // Přidáme nový záznam; ostatní záznamy musí zůstat zachovány.
    const newCounter: SavedCounter = {
      id: 'third',
      name: 'Třetí',
      value: 3,
      createdAt: '2026-09-17T10:00:00.000Z',
    };

    await service.add(newCounter);

    // Nový záznam musí být na začátku historie.
    expect(service.counters()).toEqual([newCounter, first, second]);

    // Ověříme klíč a JSON uložený do Preferences.
    expect(setMock).toHaveBeenCalledWith({
      key: 'saved-counters',
      value: JSON.stringify([newCounter, first, second]),
    });
  });

  it('should remove only the counter with the specified id and persist the result', async () => {
    getMock.mockResolvedValue({
      value: JSON.stringify([first, second]),
    });

    await service.initialize();

    await service.remove('first');

    // Odstraní se pouze záznam s odpovídajícím ID.
    expect(service.counters()).toEqual([second]);

    // Aktualizovaná historie se uloží pod správným klíčem.
    expect(setMock).toHaveBeenCalledWith({
      key: 'saved-counters',
      value: JSON.stringify([second]),
    });
  });

  it('should clear the history and remove only the saved-counters key', async () => {
    getMock.mockResolvedValue({
      value: JSON.stringify([first, second]),
    });

    await service.initialize();

    await service.clear();

    // Veřejný signál již neobsahuje žádné záznamy.
    expect(service.counters()).toEqual([]);

    // Vymazání historie odstraní uložený klíč místo ukládání prázdného pole.
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith({
      key: 'saved-counters',
    });

    // clear() nemá zapisovat novou hodnotu pomocí Preferences.set().
    expect(setMock).not.toHaveBeenCalled();
  });

  it('should handle invalid saved JSON without throwing and log an error', async () => {
    getMock.mockResolvedValue({
      value: '{invalid JSON',
    });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      // Poškozená hodnota nesmí způsobit odmítnutí inicializace.
      await expect(service.initialize()).resolves.toBeUndefined();

      // Služba musí dokončit inicializaci s prázdnou historií.
      expect(service.initialized()).toBe(true);
      expect(service.counters()).toEqual([]);

      // Chyba při zpracování uložených dat se musí zaznamenat.
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});