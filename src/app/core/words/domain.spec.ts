import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {
  alertLevelName,
  countKind,
  depthPhrase,
  kindName,
  placeName,
  regionName,
  reviewTag,
} from './domain';

// The build adds the data of the locale it is made in; a test in another one adds its own.
registerLocaleData(localePt);

describe('the domain in words', () => {
  it('counts a kind of event, one apart from any other number', () => {
    expect(countKind('explosion', 1)).toBe('1 explosion');
    expect(countKind('quarry blast', 7)).toBe('7 quarry blasts');
    expect(countKind('earthquake', 0)).toBe('0 earthquakes');
  });

  it('keeps the catalogue’s own word for a kind it has not used before', () => {
    expect(kindName('mud volcano')).toBe('mud volcano');
    expect(countKind('mud volcano', 2)).toBe('2 mud volcano');
  });

  it('stands in for a place the catalogue does not name', () => {
    expect(placeName('south of the Fiji Islands')).toBe('South of the Fiji Islands');
    expect(placeName(null)).toBe('Location not described');
  });

  it('says how deep an event was, or how far above the sea', () => {
    expect(depthPhrase(35, 'en-GB')).toBe('35.0 km deep');
    expect(depthPhrase(-1.24, 'en-GB')).toBe('1.2 km above sea level');
    expect(depthPhrase(35, 'pt-BR')).toBe('35,0 km deep');
  });

  it('names a region in the form a list takes it', () => {
    expect(regionName('central-us')).toBe('the central US');
    expect(regionName('puerto-rico')).toBe('Puerto Rico');
  });

  it('words a review status and an alert level', () => {
    expect(reviewTag('reviewed')).toBe('Reviewed');
    expect(reviewTag('automatic')).toBe('Automatic');
    expect(alertLevelName('orange')).toBe('orange');
  });
});
