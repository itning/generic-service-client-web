import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {GenericComponent} from './component/generic/generic.component';
import {SharedModule} from '../shared/shared.module';
import {AttributeItemComponent} from './component/attribute-item/attribute-item.component';
import {AttributeComponent} from './component/attribute/attribute.component';
import {ResultComponent} from './component/result/result.component';
import {LogComponent} from './component/log/log.component';


@NgModule({
  declarations: [GenericComponent, AttributeItemComponent, AttributeComponent, ResultComponent, LogComponent],
  imports: [
    CommonModule,
    SharedModule
  ]
})
export class GenericModule {
}
