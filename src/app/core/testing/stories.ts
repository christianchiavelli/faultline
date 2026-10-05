import { provideLocationMocks } from '@angular/common/testing';
import { signal } from '@angular/core';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { applicationConfig } from '@storybook/angular';
import { RECORDED_AT } from '@shared/testing/recorded-day';
import { Clock } from '../clock';

/**
 * For a story whose component links somewhere: links resolve, from an address
 * of the story's own rather than Storybook's frame, and nothing navigates.
 */
export const withRouter = applicationConfig({
  providers: [provideRouter([], withDisabledInitialNavigation()), provideLocationMocks()],
});

/** A clock stopped at the moment the recorded day was taken, so a story shows the same time every visit. */
export const withRecordedClock = applicationConfig({
  providers: [{ provide: Clock, useValue: { now: signal(RECORDED_AT).asReadonly() } }],
});
