<?php
// Мост для редиректа Robokassa: касса возвращает пользователя на Success URL методом POST,
// статический SPA не может прочитать тело POST. Этот скрипт преобразует редирект
// в GET-переход с параметрами в query string, которые уже читает фронтенд (ProfilePage).
$p = array_merge($_GET, $_POST);
$outSum = isset($p['OutSum']) ? rawurlencode((string)$p['OutSum']) : '';
$invId = isset($p['InvId']) ? rawurlencode((string)$p['InvId']) : '';
$signature = isset($p['SignatureValue']) ? rawurlencode((string)$p['SignatureValue']) : '';
header('Location: /profile?payment=success&OutSum=' . $outSum . '&InvId=' . $invId . '&SignatureValue=' . $signature, true, 302);
exit;