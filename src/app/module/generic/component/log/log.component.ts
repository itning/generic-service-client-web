import {Component, Input, OnInit, EventEmitter} from '@angular/core';
import {GenericService} from '../../../../service/generic.service';

@Component({
  selector: 'app-log',
  templateUrl: './log.component.html',
  styleUrls: ['./log.component.scss']
})
export class LogComponent implements OnInit {
  resultData: string[] = [];
  @Input()
  clearEvent: EventEmitter<void>;

  constructor(private genericService: GenericService) {
  }

  ngOnInit(): void {
    this.genericService.connectionLogWebSocket().subscribe(message => {
      this.resultData.push(message);
      // message.split('\n').forEach(line => this.resultData.push(line));
    });
    this.clearEvent.subscribe(() => this.resultData = []);
  }

}
