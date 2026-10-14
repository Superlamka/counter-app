import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { CounterService } from '../services/counter.service';

type SortOption = 'name' | 'value';
type HistoryFilter = 'all' | 'positive' | 'negative';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    DatePipe,
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class Tab2Page implements OnInit {
  readonly counterService = inject(CounterService);

  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);

  readonly searchTerm = signal('');
  readonly sortBy = signal<SortOption>('name');
  readonly historyFilter = signal<HistoryFilter>('all');

  readonly filteredCounters = computed(() => {
    const search = this.searchTerm().trim().toLocaleLowerCase('cs');
    const sort = this.sortBy();
    const filter = this.historyFilter();

    const result = this.counterService.counters().filter((counter) => {
      const matchesSearch = counter.name
        .toLocaleLowerCase('cs')
        .includes(search);

      const matchesFilter =
        filter === 'all' ||
        (filter === 'positive' && counter.value > 0) ||
        (filter === 'negative' && counter.value < 0);

      return matchesSearch && matchesFilter;
    });

    return result.sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name, 'cs');
      }

      return a.value - b.value;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.counterService.initialize();
  }

  setSearchTerm(event: CustomEvent<{ value?: string | null }>): void {
    this.searchTerm.set(event.detail.value ?? '');
  }

  setSortBy(event: CustomEvent<{ value: SortOption }>): void {
    this.sortBy.set(event.detail.value);
  }

  setHistoryFilter(event: CustomEvent<{ value: HistoryFilter }>): void {
    this.historyFilter.set(event.detail.value);
  }

  async remove(id: string): Promise<void> {
    await this.counterService.remove(id);
    await this.showToast('Záznam byl odstraněn.');
  }

  async clear(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Vymazat historii?',
      message: 'Opravdu chcete odstranit všechna uložená počítadla?',
      buttons: [
        {
          text: 'Zrušit',
          role: 'cancel',
        },
        {
          text: 'Vymazat vše',
          role: 'destructive',
          handler: () => {
            void this.clearConfirmed();
          },
        },
      ],
    });

    await alert.present();
  }

  private async clearConfirmed(): Promise<void> {
    await this.counterService.clear();
    this.searchTerm.set('');
    this.historyFilter.set('all');
    await this.showToast('Historie byla vymazána.');
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });

    await toast.present();
  }
}