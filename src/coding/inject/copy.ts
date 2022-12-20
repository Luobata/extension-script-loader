/**
 * @desc 绕过网站禁止能力
 */

const fn = (e: Event) => {
  e.stopPropagation();
};

const add = window.addEventListener('copy', fn, true);

const remove = window.removeEventListener('copy', fn, true);
